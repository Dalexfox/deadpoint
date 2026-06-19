import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import pako from 'pako';

export type BoundingBox = { x: number; y: number; width: number; height: number };

type ColorRange = {
  hMin: number;
  hMax: number;
  sMin: number;
  lMin: number;
  lMax: number;
  hWrap?: boolean;
};

// HSL ranges per spec: red wraps 345–15, others as defined
const BASE_RANGES: Record<string, ColorRange> = {
  red:    { hMin: 345, hMax: 15,  sMin: 50, lMin: 28, lMax: 72, hWrap: true },
  orange: { hMin: 16,  hMax: 44,  sMin: 55, lMin: 38, lMax: 72 },
  yellow: { hMin: 45,  hMax: 70,  sMin: 50, lMin: 48, lMax: 82 },
  green:  { hMin: 90,  hMax: 160, sMin: 38, lMin: 22, lMax: 66 },
  blue:   { hMin: 200, hMax: 245, sMin: 38, lMin: 28, lMax: 72 },
  purple: { hMin: 255, hMax: 290, sMin: 28, lMin: 28, lMax: 66 },
  pink:   { hMin: 300, hMax: 344, sMin: 38, lMin: 52, lMax: 86 },
  black:  { hMin: 0,   hMax: 360, sMin: 0,  lMin: 0,  lMax: 16 },
  white:  { hMin: 0,   hMax: 360, sMin: 0,  lMin: 78, lMax: 100 },
};

function relaxRange(color: string, r: ColorRange): ColorRange {
  if (color === 'black') return { ...r, lMax: Math.min(100, r.lMax + 5) };
  if (color === 'white') return { ...r, lMin: Math.max(0, r.lMin - 8), sMin: Math.max(0, r.sMin - 5) };
  const d = 8;
  const newHMin = r.hWrap ? ((r.hMin - d + 360) % 360) : Math.max(0, r.hMin - d);
  const newHMax = r.hWrap ? ((r.hMax + d) % 360)       : Math.min(360, r.hMax + d);
  return {
    ...r,
    hMin: newHMin,
    hMax: newHMax,
    sMin: Math.max(0, r.sMin - 15),
    lMin: Math.max(0, r.lMin - 10),
    lMax: Math.min(100, r.lMax + 10),
  };
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else                 h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function matchesRange(h: number, s: number, l: number, color: string, range: ColorRange): boolean {
  if (color === 'black') return l <= range.lMax;
  if (color === 'white') return l >= range.lMin && s <= (range.sMin > 0 ? range.sMin : 20);
  if (s < range.sMin || l < range.lMin || l > range.lMax) return false;
  if (range.hWrap) return h >= range.hMin || h <= range.hMax;
  return h >= range.hMin && h <= range.hMax;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset+1] << 16) | (bytes[offset+2] << 8) | bytes[offset+3]) >>> 0;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function parsePNGPixels(buffer: ArrayBuffer): { width: number; height: number; rgb: Uint8Array } | null {
  const bytes = new Uint8Array(buffer);
  let pos = 8;
  let width = 0, height = 0, colorType = 2;
  const idatChunks: Uint8Array[] = [];

  while (pos < bytes.length - 8) {
    const length = readUint32BE(bytes, pos); pos += 4;
    const type = String.fromCharCode(bytes[pos], bytes[pos+1], bytes[pos+2], bytes[pos+3]); pos += 4;
    if (type === 'IHDR') {
      width     = readUint32BE(bytes, pos);
      height    = readUint32BE(bytes, pos + 4);
      colorType = bytes[pos + 9];
    } else if (type === 'IDAT') {
      idatChunks.push(new Uint8Array(buffer, pos, length));
    } else if (type === 'IEND') {
      break;
    }
    pos += length + 4;
  }

  if (width === 0 || height === 0) return null;

  const totalLen = idatChunks.reduce((n, c) => n + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const c of idatChunks) { compressed.set(c, off); off += c.length; }
  const raw = pako.inflate(compressed);

  const channels = [1, 0, 3, 0, 2, 0, 4][colorType] ?? 3;
  const stride = width * channels;
  const reconstructed = new Uint8Array(height * stride);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * (stride + 1)];
    const srcBase   = y * (stride + 1) + 1;
    const dstBase   = y * stride;
    const prevBase  = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const raw_byte = raw[srcBase + x];
      const left   = x >= channels ? reconstructed[dstBase + x - channels] : 0;
      const up     = y > 0          ? reconstructed[prevBase + x]           : 0;
      const upLeft = y > 0 && x >= channels ? reconstructed[prevBase + x - channels] : 0;
      let val: number;
      switch (filterType) {
        case 1: val = (raw_byte + left)                                     & 0xff; break;
        case 2: val = (raw_byte + up)                                       & 0xff; break;
        case 3: val = (raw_byte + Math.floor((left + up) / 2))             & 0xff; break;
        case 4: val = (raw_byte + paethPredictor(left, up, upLeft))        & 0xff; break;
        default: val = raw_byte;
      }
      reconstructed[dstBase + x] = val;
    }
  }

  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    if (channels === 3) {
      rgb[i*3] = reconstructed[i*3]; rgb[i*3+1] = reconstructed[i*3+1]; rgb[i*3+2] = reconstructed[i*3+2];
    } else if (channels === 4) {
      rgb[i*3] = reconstructed[i*4]; rgb[i*3+1] = reconstructed[i*4+1]; rgb[i*3+2] = reconstructed[i*4+2];
    } else {
      const g = reconstructed[i * channels];
      rgb[i*3] = g; rgb[i*3+1] = g; rgb[i*3+2] = g;
    }
  }

  return { width, height, rgb };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function scanForClusters(
  rgb: Uint8Array,
  width: number,
  height: number,
  color: string,
  range: ColorRange,
): BoundingBox[] {
  const CELL = 5;
  const gridW = Math.ceil(width  / CELL);
  const gridH = Math.ceil(height / CELL);
  const cellCounts = new Array(gridW * gridH).fill(0);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 3;
      const [h, s, l] = rgbToHsl(rgb[idx], rgb[idx+1], rgb[idx+2]);
      if (matchesRange(h, s, l, color, range)) {
        const cx = Math.floor(px / CELL);
        const cy = Math.floor(py / CELL);
        cellCounts[cy * gridW + cx]++;
      }
    }
  }

  const cellThreshold = (CELL * CELL) * 0.4;
  const active = cellCounts.map(c => c >= cellThreshold);

  const visited = new Array(gridW * gridH).fill(false);
  const clusters: number[][] = [];

  for (let ci = 0; ci < active.length; ci++) {
    if (!active[ci] || visited[ci]) continue;
    const cluster: number[] = [];
    const queue = [ci];
    visited[ci] = true;
    while (queue.length) {
      const cur = queue.shift()!;
      cluster.push(cur);
      const cx = cur % gridW, cy = Math.floor(cur / gridW);
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx+dx, ny = cy+dy;
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
        const ni = ny * gridW + nx;
        if (!visited[ni] && active[ni]) { visited[ni] = true; queue.push(ni); }
      }
    }
    clusters.push(cluster);
  }

  // Relative threshold: cluster must cover ≥0.15% of total image pixels
  const totalPixels = width * height;
  const MIN_CELLS = Math.max(1, Math.ceil((totalPixels * 0.0015) / (CELL * CELL)));
  const boxes: BoundingBox[] = [];

  for (const cluster of clusters) {
    if (cluster.length < MIN_CELLS) continue;
    let minCx = gridW, maxCx = 0, minCy = gridH, maxCy = 0;
    for (const ci of cluster) {
      const cx = ci % gridW, cy = Math.floor(ci / gridW);
      if (cx < minCx) minCx = cx; if (cx > maxCx) maxCx = cx;
      if (cy < minCy) minCy = cy; if (cy > maxCy) maxCy = cy;
    }
    boxes.push({
      x:      clamp(minCx * CELL / width,  0, 1),
      y:      clamp(minCy * CELL / height, 0, 1),
      width:  clamp((maxCx - minCx + 1) * CELL / width,  0, 1),
      height: clamp((maxCy - minCy + 1) * CELL / height, 0, 1),
    });
  }

  return boxes;
}

async function detectPipeline(imageUri: string, color: string): Promise<BoundingBox[]> {
  // Downscale to max 480px wide — bounds scan time, keeps thresholds predictable
  const resized = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 480 } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  if (!resized.base64) return [];

  const buffer = decodeBase64(resized.base64);
  const parsed = parsePNGPixels(buffer);
  if (!parsed) return [];

  const { width, height, rgb } = parsed;
  const baseRange = BASE_RANGES[color];
  if (!baseRange) return [];

  let boxes = scanForClusters(rgb, width, height, color, baseRange);

  // One adaptive retry with relaxed bounds for difficult lighting
  if (boxes.length === 0) {
    boxes = scanForClusters(rgb, width, height, color, relaxRange(color, baseRange));
  }

  return boxes;
}

export async function detectHolds(imageUri: string, color: string): Promise<BoundingBox[]> {
  const timeout = new Promise<BoundingBox[]>(resolve => setTimeout(() => resolve([]), 4000));
  try {
    return await Promise.race([detectPipeline(imageUri, color), timeout]);
  } catch (err) {
    console.warn('[holdDetection] pipeline error:', err);
    return [];
  }
}

// ─── Sample the hold color at a single point ──────────────────────────────────
// FAR more reliable than detectHolds(): instead of searching a noisy image for
// all holds of a colour, we read the colour at ONE known point (the start hold the
// climber tapped, x/y are 0–1 proportional) and vote a small window around it
// against the colour ranges. Used to auto-select the hold-colour chip once a start
// hold is marked. Returns the best colour id, or null if the sample is ambiguous.
function imageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
  });
}

async function sampleColorPipeline(imageUri: string, x: number, y: number): Promise<string | null> {
  const size = await imageSize(imageUri);
  if (!size) return null;
  const { width: W, height: H } = size;

  // Crop a tight region centred on the tapped point (~10% of the smaller side) and
  // sample THAT at full res — so the hold fills most of the sample no matter how
  // zoomed-out the original photo is (a fixed window in a 480px downscale missed
  // small holds). Then vote every pixel of the crop against the colour ranges.
  const cropSize = clamp(Math.round(Math.min(W, H) * 0.10), 48, 400);
  const originX  = clamp(Math.round(x * W - cropSize / 2), 0, Math.max(0, W - cropSize));
  const originY  = clamp(Math.round(y * H - cropSize / 2), 0, Math.max(0, H - cropSize));
  const cw = Math.min(cropSize, W - originX);
  const ch = Math.min(cropSize, H - originY);
  if (cw < 2 || ch < 2) return null;

  const cropped = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ crop: { originX, originY, width: cw, height: ch } }, { resize: { width: 64 } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  if (!cropped.base64) return null;
  const parsed = parsePNGPixels(decodeBase64(cropped.base64));
  if (!parsed) return null;

  const { width, height, rgb } = parsed;
  const votes: Record<string, number> = {};
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const [h, s, l] = rgbToHsl(rgb[idx], rgb[idx + 1], rgb[idx + 2]);
    for (const color in BASE_RANGES) {              // colored ranges first, black/white last
      if (matchesRange(h, s, l, color, BASE_RANGES[color])) {
        votes[color] = (votes[color] ?? 0) + 1;
        break;
      }
    }
  }

  let best: string | null = null, bestN = 0;
  for (const color in votes) {
    if (votes[color] > bestN) { bestN = votes[color]; best = color; }
  }
  // Require the winning colour to cover a meaningful share of the crop.
  return best && n > 0 && bestN >= n * 0.15 ? best : null;
}

export async function sampleHoldColor(imageUri: string, x: number, y: number): Promise<string | null> {
  const timeout = new Promise<string | null>(resolve => setTimeout(() => resolve(null), 4000));
  try {
    return await Promise.race([sampleColorPipeline(imageUri, x, y), timeout]);
  } catch (err) {
    console.warn('[holdDetection] sampleHoldColor error:', err);
    return null;
  }
}
