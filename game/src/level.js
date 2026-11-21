// Ember Archive — level data, collision, line of sight, and level drawing.
//
// The archive is one big reading hall seen from above: stone floor, heavy
// shelves (walls), crates that block both movement and sight, and soft
// fern bushes you can crouch inside to vanish from a warden's gaze.

export const TILE = 48;
export const COLS = 20;
export const ROWS = 15;

// Legend: '#' wall/shelf, '.' floor, 'C' crate, 'B' bush,
// '1' '2' '3' keycards, 'E' exit, 'P' player start.
export const MAP = [
  "####################",
  "#P....#......#....E#",
  "#..B..#..1...#..B..#",
  "#.....#......#.....#",
  "###.######.#####.###",
  "#.....#......#.....#",
  "#..C..#..B...#..C..#",
  "#.....#......#.....#",
  "###.######.#####.###",
  "#.....#......#.....#",
  "#..B..#..2...#..B..#",
  "#.....#......#.....#",
  "###.######.#####.###",
  "#.....#..3.........#",
  "####################",
];

export const KEYCARD_DEFS = [
  { id: 1, name: "Sun Card", color: "#f5b942" },
  { id: 2, name: "Moon Card", color: "#7fb3ff" },
  { id: 3, name: "Star Card", color: "#c98cff" },
];

export function tileAt(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return "#";
  return MAP[row][col];
}

export function isSolid(col, row) {
  const t = tileAt(col, row);
  return t === "#" || t === "C";
}

export function blocksSight(col, row) {
  const t = tileAt(col, row);
  return t === "#" || t === "C";
}

export function isBush(col, row) {
  return tileAt(col, row) === "B";
}

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

export function findTile(ch) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (MAP[row][col] === ch) return { col, row };
    }
  }
  return null;
}

export function playerStart() {
  const t = findTile("P");
  return tileCenter(t.col, t.row);
}

export function exitRect() {
  const t = findTile("E");
  return { x: t.col * TILE + 4, y: t.row * TILE + 4, w: TILE - 8, h: TILE - 8 };
}

export function keycardSpots() {
  return KEYCARD_DEFS.map((def) => {
    const t = findTile(String(def.id));
    const c = tileCenter(t.col, t.row);
    return { ...def, x: c.x, y: c.y, taken: false };
  });
}

// Circle-vs-solid-tiles collision: true when the circle overlaps a solid tile.
export function circleHitsSolid(x, y, r) {
  const c0 = Math.floor((x - r) / TILE);
  const c1 = Math.floor((x + r) / TILE);
  const r0 = Math.floor((y - r) / TILE);
  const r1 = Math.floor((y + r) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!isSolid(col, row)) continue;
      const nx = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const ny = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// Move a circle by (dx, dy), sliding along walls: try x first, then y.
export function moveCircle(pos, dx, dy, r) {
  let nx = pos.x;
  let ny = pos.y;
  if (dx !== 0 && !circleHitsSolid(pos.x + dx, pos.y, r)) nx = pos.x + dx;
  if (dy !== 0 && !circleHitsSolid(nx, pos.y + dy, r)) ny = pos.y + dy;
  return { x: nx, y: ny };
}

// Line of sight between two points, sampled in small steps; walls and
// crates block it, bushes and floor do not.
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const col = Math.floor((x0 + dx * t) / TILE);
    const row = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(col, row)) return false;
  }
  return true;
}

// Deterministic speckles so the floor looks lived-in but stable.
function hash2(col, row) {
  let h = (col * 374761393 + row * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export function drawFloor(ctx) {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * TILE;
      const y = row * TILE;
      const even = (col + row) % 2 === 0;
      ctx.fillStyle = even ? "#1d2333" : "#1a1f2d";
      ctx.fillRect(x, y, TILE, TILE);
      // faint rug border on floor tiles
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      const h = hash2(col, row);
      if (h > 0.55) {
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        ctx.fillRect(x + 8 + h * 24, y + 10 + (1 - h) * 20, 3, 3);
      }
    }
  }
}

function drawWallTile(ctx, col, row) {
  const x = col * TILE;
  const y = row * TILE;
  ctx.fillStyle = "#3d2f23";
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = "#54432e";
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  // shelf ridges
  ctx.fillStyle = "#6b5636";
  ctx.fillRect(x + 5, y + 12, TILE - 10, 4);
  ctx.fillRect(x + 5, y + 28, TILE - 10, 4);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x, y + TILE - 5, TILE, 5);
}

function drawCrate(ctx, col, row) {
  const x = col * TILE + 4;
  const y = row * TILE + 4;
  const s = TILE - 8;
  // Soft drop shadow so crates sit on the floor instead of floating on it.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 3, y + 5, s, s);
  ctx.fillStyle = "#7a5a30";
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = "#543d1e";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + 3, y + 3, s - 6, 4);
}

export function drawBushTile(ctx, col, row, alpha = 1) {
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  const blobs = [
    [-12, -6, 13],
    [10, -10, 12],
    [12, 8, 13],
    [-10, 10, 12],
    [0, 0, 14],
  ];
  for (const [ox, oy, r] of blobs) {
    ctx.fillStyle = "#2c5a34";
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3c7a45";
    ctx.beginPath();
    ctx.arc(cx + ox - 3, cy + oy - 3, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawLevel(ctx, time) {
  drawFloor(ctx);
  // Exit zone: a softly pulsing moonlit doorway.
  const e = exitRect();
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
  ctx.save();
  ctx.fillStyle = `rgba(80, 220, 140, ${0.16 + 0.1 * pulse})`;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = "#50dc8c";
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
  ctx.fillStyle = "#b8ffd6";
  ctx.font = "bold 11px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", e.x + e.w / 2, e.y + e.h / 2);
  ctx.restore();
  // Walls, crates and bushes.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const t = MAP[row][col];
      if (t === "#") drawWallTile(ctx, col, row);
      else if (t === "C") drawCrate(ctx, col, row);
      else if (t === "B") drawBushTile(ctx, col, row);
    }
  }
}
