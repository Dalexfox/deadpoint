"""Trace the gridded wall regions from the Vital LES routesetting-board photo.

Stages:
  1. Deskew  — find the dark board quad, perspective-warp to a square canvas.
  2. Mask    — white blueprint linework = high V, low S. Hatched wall areas are
               DENSE linework; structural outlines are sparse. Local density
               thresholding separates them. Saturated chalk art is excluded.
  3. Contour — connected components -> large blobs -> simplified polygons.

Outputs (in ./out): 01_board.png, 02_mask.png, 03_overlay.png, polygons.json
"""
import json
import os

import cv2
import numpy as np

SRC = "/Users/alexfox/Desktop/DEADPOINT/LES_FloormapDrawing.JPG"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)

WARP = 2000          # warped board canvas size (square-ish board)
PREVIEW = 1200       # preview image max dim

# ── Tunables ─────────────────────────────────────────────────────
SAT_MAX_WHITE = 70       # S below this counts as "white linework" candidate
VAL_MIN_WHITE = 110      # V above this counts as "white linework" candidate
SAT_MIN_CHALK = 90       # S above this = colored chalk -> excluded
DENSITY_WIN  = 17        # px window for local line-density
DENSITY_MIN  = 0.19
DENSITY_MAX  = 0.52   # above this = solid marker (text/doodles), not hatch      # fraction of white pixels in window to call it "hatched"
CLOSE_K      = 21        # morphological close kernel (bridge hatch gaps)
OPEN_K       = 15        # morphological open kernel (drop thin strokes)
MIN_AREA     = 6000      # min blob area (at WARP scale) to keep
EPS_FRAC     = 0.002     # polygon simplification (fraction of perimeter)


def save_preview(name: str, img) -> None:
    h, w = img.shape[:2]
    s = PREVIEW / max(h, w)
    if s < 1:
        img = cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(OUT, name), img)


def order_quad(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([pts[np.argmin(s)], pts[np.argmin(d)],
                     pts[np.argmax(s)], pts[np.argmax(d)]], dtype=np.float32)


# ── Stage 1: deskew ──────────────────────────────────────────────
img = cv2.imread(SRC)
scale = 2400 / max(img.shape[:2])
img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
dark = ((hsv[:, :, 2] < 120)).astype(np.uint8) * 255
dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((25, 25), np.uint8))
cnts, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
board = max(cnts, key=cv2.contourArea)
peri = cv2.arcLength(board, True)
quad = cv2.approxPolyDP(board, 0.02 * peri, True)
if len(quad) != 4:  # fall back to min-area rect corners
    quad = cv2.boxPoints(cv2.minAreaRect(board)).astype(np.int32).reshape(-1, 1, 2)
quad = order_quad(quad.reshape(-1, 2).astype(np.float32))
dst = np.array([[0, 0], [WARP, 0], [WARP, WARP], [0, WARP]], dtype=np.float32)
M = cv2.getPerspectiveTransform(quad, dst)
warped = cv2.warpPerspective(img, M, (WARP, WARP))
save_preview("01_board.png", warped)

# ── Stage 2: hatched-region mask ─────────────────────────────────
whsv = cv2.cvtColor(warped, cv2.COLOR_BGR2HSV)
S = whsv[:, :, 1]
gray = whsv[:, :, 2]
# Adaptive threshold: robust to the photo's uneven lighting/glare.
lines = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
                              cv2.THRESH_BINARY, 41, -18)
chalk = (S > SAT_MIN_CHALK).astype(np.uint8)
chalk = cv2.dilate(chalk, np.ones((9, 9), np.uint8))
lines[chalk > 0] = 0
white = (lines > 0).astype(np.float32)
save_preview("02a_lines.png", lines)

density = cv2.boxFilter(white, -1, (DENSITY_WIN, DENSITY_WIN))
save_preview("02b_density.png", (np.clip(density, 0, 0.7) / 0.7 * 255).astype(np.uint8))
mask = ((density > DENSITY_MIN) & (density < DENSITY_MAX)).astype(np.uint8) * 255
# Region of interest: zero out the title band, week legend, margins, footer text
H = W = mask.shape[0]
mask[: int(0.075 * H), :] = 0                       # ROUTESETTING SCHEDULE title
mask[int(0.06 * H): int(0.19 * H), int(0.24 * W): int(0.58 * W)] = 0  # TB2/Kilter note box
mask[int(0.28 * H): int(0.44 * H), int(0.09 * W): int(0.38 * W)] = 0   # wave chalk art (white foam)
mask[int(0.21 * H): int(0.27 * H), int(0.28 * W): int(0.58 * W)] = 0  # 'thank you' text line
mask[: int(0.42 * H), int(0.80 * W):] = 0           # week-of legend block
mask[:, : int(0.105 * W)] = 0                       # left margin + left-edge wall line
mask[: int(0.40 * H), : int(0.24 * W)] = 0          # top-left rooms (lockers/bathrooms)
mask[:, int(0.90 * W):] = 0                         # right margin doodles
mask[int(0.93 * H):, :] = 0                         # footer / scale text
mask[int(0.88 * H):, : int(0.30 * W)] = 0           # turtle corner
mask[int(0.715 * H): int(0.735 * H), int(0.12 * W): int(0.34 * W)] = 0  # doorway gap: tunnel vs 60° band
mask[int(0.60 * H): int(0.742 * W), int(0.46 * W): int(0.57 * W)] = 0  # elevator machine room block
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((CLOSE_K, CLOSE_K), np.uint8))
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((OPEN_K, OPEN_K), np.uint8))
# The bottom band (60° -> front desk -> elevator -> slackline slab) is thin and
# chalk-occluded — bridge it locally so it contours as ONE band like the drawing.
y0, y1, x0, x1 = int(0.745 * H), int(0.88 * H), int(0.14 * W), int(0.80 * W)
strip = mask[y0:y1, x0:x1]
mask[y0:y1, x0:x1] = cv2.morphologyEx(strip, cv2.MORPH_CLOSE, np.ones((51, 51), np.uint8))
save_preview("02_mask.png", mask)

# ── Stage 3: contours -> polygons ────────────────────────────────
cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
hier = hier[0] if hier is not None else []
overlay = warped.copy()
polys = []

def simplify(c):
    eps = EPS_FRAC * cv2.arcLength(c, True)
    return cv2.approxPolyDP(c, eps, True).reshape(-1, 2)

def norm(pts):
    return [[round(float(x) / WARP, 4), round(float(y) / WARP, 4)] for x, y in pts]

order = sorted(range(len(cnts)), key=lambda i: cv2.contourArea(cnts[i]), reverse=True)
for i in order:
    if hier[i][3] != -1:
        continue  # child (hole) — handled with its parent
    c = cnts[i]
    area = cv2.contourArea(c)
    if area < MIN_AREA:
        continue
    x, y, w, h = cv2.boundingRect(c)
    if x <= 2 or y <= 2 or x + w >= WARP - 2 or y + h >= WARP - 2:
        continue  # touches the border -> board-edge junk, not a wall
    poly = simplify(c)
    holes = []
    for j in range(len(cnts)):
        if hier[j][3] == i and cv2.contourArea(cnts[j]) > 3000:
            holes.append(simplify(cnts[j]))
    polys.append({
        "area": int(area),
        "points": norm(poly),
        "holes": [norm(hp) for hp in holes],
    })
    cv2.polylines(overlay, [poly.reshape(-1, 1, 2)], True, (0, 255, 0), 4)
    for hp in holes:
        cv2.polylines(overlay, [hp.reshape(-1, 1, 2)], True, (0, 160, 255), 3)
    cx, cy = poly.mean(axis=0).astype(int)
    cv2.putText(overlay, str(len(polys) - 1), (cx, cy), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 200, 255), 3)

# ── Stage 4: assign blobs to named zones via seed points ─────────
ZONE_SEEDS = {
    "west_complex":  [(0.20, 0.48), (0.16, 0.55), (0.235, 0.61), (0.44, 0.60), (0.17, 0.65), (0.33, 0.68)],
    "inner_island":  [(0.33, 0.61)],
    "stairwell_35":  [(0.43, 0.375)],
    "horseshoe":     [(0.53, 0.50), (0.665, 0.41)],
    "wall_40":       [(0.59, 0.585)],
    "bottom_band":   [(0.33, 0.79), (0.57, 0.81), (0.72, 0.775)],
    
}
named = {}
# Boards (TB2 + Kilter) — hand-placed quad; the printed outline is tangled in
# text/legend on the photo, but its corners are unambiguous on the deskewed board.
named["boards"] = [{"area": 0, "points": [[0.72, 0.175], [0.78, 0.16], [0.79, 0.187], [0.73, 0.202]], "holes": []}]
for name, seeds in ZONE_SEEDS.items():
    for p in sorted(polys, key=lambda q: q["area"]):  # smallest container = most specific
        cnt = (np.array(p["points"], dtype=np.float32) * WARP).reshape(-1, 1, 2)
        if any(cv2.pointPolygonTest(cnt, (sx * WARP, sy * WARP), False) >= 0 for sx, sy in seeds):
            named.setdefault(name, []).append(p)
            break  # first (largest-area-sorted) match wins

final = warped.copy()
for name, plist in named.items():
    for p in plist:
        pts = (np.array(p["points"]) * WARP).astype(np.int32)
        cv2.polylines(final, [pts.reshape(-1, 1, 2)], True, (0, 255, 0), 5)
        for hp in p.get("holes", []):
            hpts = (np.array(hp) * WARP).astype(np.int32)
            cv2.polylines(final, [hpts.reshape(-1, 1, 2)], True, (0, 160, 255), 4)
        cx, cy = pts.mean(axis=0).astype(int)
        cv2.putText(final, name, (cx - 90, cy), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (60, 220, 255), 3)
save_preview("04_named.png", final)

save_preview("03_overlay.png", overlay)
with open(os.path.join(OUT, "polygons.json"), "w") as f:
    json.dump(polys, f)
with open(os.path.join(OUT, "zones.json"), "w") as f:
    json.dump(named, f)
matched = {k: len(v) for k, v in named.items()}
print(f"blobs kept: {len(polys)}; zones matched: {matched}")
