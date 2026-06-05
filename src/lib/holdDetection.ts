import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import pako from 'pako';

export type BoundingBox = { x: number; y: number; width: number; height: number };

// HSL ranges for each hold color
const COLOR_RANGES: Record<string, { hMin: number; hMax: number; sMin: number; lMin: number; lMax: number; hWrap?: boolean }> = {
  red:    { hMin: 350, hMax: 10,  sMin: 50, lMin: 28, lMax: 72, hWrap: true },
  orange: { hMin: 15,  hMax: 40,  sMin: 55, lMin: 38, lMax: 72 },
  yellow: { hMin: 40,  hMax: 70,  sMin: 50, lMin: 48, lMax: 82 },
  green:  { hMin: 88,  hMax: 152, sMin: 38, lMin: 22, lMax: 66 },
  blue:   { hMin: 195, hMax: 248, sMin: 38, lMin: 28, lMax: 72 },
  purple: { hMin: 262, hMax: 312, sMin: 28, lMin: 28, lMax: 66 },
  pink:   { hMin: 312, hMax: 352, sMin: 38, lMin: 52, lMax: 86 },
  black:  { hMin: 0,   hMax: 360, sMin: 0,  lMin: 0,  lMax: 18 },
  white:  { hMin: 0,   hMax: 360, sMin: 0,  lMin: 78, lMax: 100 },
};

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

function matchesColor(h: number, s: number, l: number, color: string): boolean {
  const range = COLOR_RANGES[color];
  if (!range) return false;
  if (s < range.sMin || l < range.lMin || l > range.lMax) return false;
  // Special case: black/white ignore saturation bounds
  if (color === 'black') return l <= range.lMax;
  if (color === 'white') return l >= range.lMin && s <= 20;
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
  let pos = 8; // skip PNG signature
  let width = 0, height = 0, colorType = 2, bitDepth = 8;
  const idatChunks: Uint8Array[] = [];

  while (pos < bytes.length - 8) {
    const length = readUint32BE(bytes, pos); pos += 4;
    const type = String.fromCharCode(bytes[pos], bytes[pos+1], bytes[pos+2], bytes[pos+3]); pos += 4;
    if (type === 'IHDR') {
      width     = readUint32BE(bytes, pos);
      height    = readUint32BE(bytes, pos + 4);
      bitDepth  = bytes[pos + 8];
      colorType = bytes[pos + 9];
    } else if (type === 'IDAT') {
      idatChunks.push(new Uint8Array(buffer, pos, length));
    } else if (type === 'IEND') {
      break;
    }
    pos += length + 4; // data + CRC
  }

  if (width === 0 || height === 0) return null;

  // Concatenate and inflate IDAT
  const totalLen = idatChunks.reduce((n, c) => n + c.length, 0);
  const compressed = new Uint8Array(totalLen);
  let off = 0;
  for (const c of idatChunks) { compressed.set(c, off); off += c.length; }
  const raw = pako.inflate(compressed);

  // channels: 2=RGB(3), 6=RGBA(4), 0=Gray(1), 4=GrayA(2)
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

  // Extract RGB only
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

export async function detectHolds(imageUri: string, color: string): Promise<BoundingBox[]> {
  // Resize to 100×100 PNG, export as base64
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 100, height: 100 } }],
    { format: ImageManipulator.SaveFormat.PNG, base64: true },
  );
  if (!result.base64) return [];

  const buffer   = decodeBase64(result.base64);
  const parsed   = parsePNGPixels(buffer);
  if (!parsed) return [];

  const { width, height, rgb } = parsed;
  const CELL = 5; // 5×5 pixel cells → 20×20 grid
  const gridW = Math.ceil(width  / CELL);
  const gridH = Math.ceil(height / CELL);
  const cellCounts = new Array(gridW * gridH).fill(0);

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = (py * width + px) * 3;
      const [h, s, l] = rgbToHsl(rgb[idx], rgb[idx+1], rgb[idx+2]);
      if (matchesColor(h, s, l, color)) {
        const cx = Math.floor(px / CELL);
        const cy = Math.floor(py / CELL);
        cellCounts[cy * gridW + cx]++;
      }
    }
  }

  // Mark cells that are mostly matching (>40% of CELL² pixels)
  const threshold = (CELL * CELL) * 0.4;
  const active = cellCounts.map(c => c >= threshold);

  // Flood-fill to find connected clusters of active cells
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

  // Convert clusters to bounding boxes, filtering noise (< 400px² ≈ 16 cells at 5px each)
  const MIN_CELLS = Math.ceil(400 / (CELL * CELL));
  const boxes: BoundingBox[] = [];

  for (const cluster of clusters) {
    if (cluster.length < MIN_CELLS) continue;
    let minCx = gridW, maxCx = 0, minCy = gridH, maxCy = 0;
    for (const ci of cluster) {
      const cx = ci % gridW, cy = Math.floor(ci / gridW);
      if (cx < minCx) minCx = cx; if (cx > maxCx) maxCx = cx;
      if (cy < minCy) minCy = cy; if (cy > maxCy) maxCy = cy;
    }
    // Convert cell coords → proportional 0–1 (relative to original image)
    boxes.push({
      x:      clamp(minCx * CELL / width,  0, 1),
      y:      clamp(minCy * CELL / height, 0, 1),
      width:  clamp((maxCx - minCx + 1) * CELL / width,  0, 1),
      height: clamp((maxCy - minCy + 1) * CELL / height, 0, 1),
    });
  }

  return boxes;
}
