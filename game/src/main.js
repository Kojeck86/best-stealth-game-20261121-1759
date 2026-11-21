// Ember Archive — game loop, input, screens and HUD.
//
// You are Luma, a little firefly thief. Slip through the Ember Archive,
// pocket the three keycards (Sun, Moon, Star), and reach the moonlit exit
// without a warden catching you. Wardens patrol with vision cones; bushes
// hide you, crates block their sight, and sneaking (Shift) makes you
// harder to spot — but slower.

import { SoundManager } from "./audio.js";
import {
  TILE,
  drawLevel,
  drawBushTile,
  exitRect,
  isBush,
  keycardSpots,
  moveCircle,
  playerStart,
} from "./level.js";
import { makeGuards, CHASE_TRIGGER } from "./guards.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const sound = new SoundManager();

const WALK_SPEED = 152;
const SNEAK_SPEED = 86;
const PLAYER_R = 14;

const game = {
  state: "start", // 'start' | 'playing' | 'won' | 'lost'
  time: 0,
  detections: 0,
  caughtBy: null,
  player: null,
  guards: [],
  keycards: [],
  keys: {},
  clickTarget: null,
  mouse: { x: 0, y: 0 },
};

function resetGame() {
  const start = playerStart();
  game.state = "playing";
  game.time = 0;
  game.detections = 0;
  game.caughtBy = null;
  game.player = {
    x: start.x,
    y: start.y,
    sneaking: false,
    moving: false,
    wingPhase: 0,
    faceAngle: 0,
  };
  game.guards = makeGuards();
  game.keycards = keycardSpots();
  game.clickTarget = null;
}

function startGame() {
  sound.ensure();
  sound.click();
  resetGame();
}

// ---- input ---------------------------------------------------------------

const MOVE_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"];

window.addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") {
    sound.toggle();
    return;
  }
  if (game.state === "start" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    startGame();
    return;
  }
  if ((game.state === "won" || game.state === "lost") && (e.key === "r" || e.key === "R" || e.key === "Enter")) {
    startGame();
    return;
  }
  if (game.state === "playing" && (e.key === "r" || e.key === "R")) {
    resetGame();
    return;
  }
  if (MOVE_KEYS.includes(e.key)) {
    game.keys[e.key] = true;
    if (game.state === "playing") game.clickTarget = null; // keys override click-to-move
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  }
  if (e.key === "Shift") game.keys.Shift = true;
});

window.addEventListener("keyup", (e) => {
  if (MOVE_KEYS.includes(e.key)) game.keys[e.key] = false;
  if (e.key === "Shift") game.keys.Shift = false;
});

// If the tab loses focus mid-run, drop all held keys so Luma never keeps
// walking (or sneaking) on her own when the player comes back.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.keys = {};
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  game.mouse.x = ((e.clientX - rect.left) / rect.width) * W;
  game.mouse.y = ((e.clientY - rect.top) / rect.height) * H;
});

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * W;
  const y = ((e.clientY - rect.top) / rect.height) * H;
  if (game.state === "start") {
    startGame();
    return;
  }
  if (game.state === "won" || game.state === "lost") {
    startGame();
    return;
  }
  if (game.state === "playing") {
    game.clickTarget = { x, y };
    sound.click();
  }
});

// ---- update ---------------------------------------------------------------

function updatePlayer(dt) {
  const p = game.player;
  let dx = 0;
  let dy = 0;
  if (game.keys.ArrowUp || game.keys.w || game.keys.W) dy -= 1;
  if (game.keys.ArrowDown || game.keys.s || game.keys.S) dy += 1;
  if (game.keys.ArrowLeft || game.keys.a || game.keys.A) dx -= 1;
  if (game.keys.ArrowRight || game.keys.d || game.keys.D) dx += 1;

  if (dx === 0 && dy === 0 && game.clickTarget) {
    const tx = game.clickTarget.x - p.x;
    const ty = game.clickTarget.y - p.y;
    const dist = Math.hypot(tx, ty);
    if (dist < 8) {
      game.clickTarget = null;
    } else {
      dx = tx / dist;
      dy = ty / dist;
    }
  }

  p.sneaking = !!game.keys.Shift;
  const speed = p.sneaking ? SNEAK_SPEED : WALK_SPEED;
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    const stepX = (dx / len) * speed * dt;
    const stepY = (dy / len) * speed * dt;
    const moved = moveCircle(p, stepX, stepY, PLAYER_R);
    p.x = moved.x;
    p.y = moved.y;
    p.faceAngle = Math.atan2(dy, dx);
    p.wingPhase += dt * (p.sneaking ? 14 : 26);
  }

  // Pick up keycards.
  for (const card of game.keycards) {
    if (!card.taken && Math.hypot(card.x - p.x, card.y - p.y) < 30) {
      card.taken = true;
      sound.pickup();
    }
  }

  // Reach the exit with all three cards to win.
  const allTaken = game.keycards.every((c) => c.taken);
  if (allTaken) {
    const e = exitRect();
    if (p.x > e.x && p.x < e.x + e.w && p.y > e.y && p.y < e.y + e.h) {
      game.state = "won";
      sound.win();
    }
  }
}

function update(dt) {
  if (game.state !== "playing") return;
  game.time += dt;
  updatePlayer(dt);
  if (game.state !== "playing") return; // updatePlayer may have won the run
  for (const guard of game.guards) {
    const result = guard.update(dt, game.player);
    if (result === "spotted") {
      game.detections += 1;
      sound.spotted();
    } else if (result === "caught") {
      game.state = "lost";
      game.caughtBy = guard.name;
      sound.caught();
      return;
    }
  }
}

// ---- drawing ---------------------------------------------------------------

function visibilityLabel() {
  const p = game.player;
  if (!p) return "";
  const anyChase = game.guards.some((g) => g.state === "chase");
  if (anyChase) return "HUNTED";
  const anySeeing = game.guards.some((g) => g.canSee(p));
  if (anySeeing) return "SEEN";
  const inBush = isBush(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
  if (inBush) return "HIDDEN (in bush)";
  if (p.sneaking) return "SNEAKING";
  return "UNSEEN";
}

function drawKeycards(ctx2, time) {
  for (const card of game.keycards) {
    if (card.taken) continue;
    const bob = Math.sin(time * 3 + card.id) * 3;
    const glow = 0.55 + 0.35 * Math.sin(time * 4 + card.id * 2);
    ctx2.save();
    ctx2.shadowColor = card.color;
    ctx2.shadowBlur = 18 * glow;
    ctx2.fillStyle = card.color;
    ctx2.fillRect(card.x - 11, card.y - 15 + bob, 22, 30);
    ctx2.shadowBlur = 0;
    ctx2.strokeStyle = "rgba(0,0,0,0.5)";
    ctx2.lineWidth = 2;
    ctx2.strokeRect(card.x - 11, card.y - 15 + bob, 22, 30);
    ctx2.fillStyle = "#141824";
    ctx2.font = "bold 16px Georgia, serif";
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(String(card.id), card.x, card.y + 1 + bob);
    ctx2.restore();
  }
}

function drawPlayer(ctx2) {
  const p = game.player;
  const flap = Math.sin(p.wingPhase) * 0.5;
  ctx2.save();
  ctx2.translate(p.x, p.y);
  // Firefly glow.
  const glow = ctx2.createRadialGradient(0, 0, 2, 0, 0, 46);
  glow.addColorStop(0, "rgba(255, 214, 90, 0.55)");
  glow.addColorStop(1, "rgba(255, 214, 90, 0)");
  ctx2.fillStyle = glow;
  ctx2.beginPath();
  ctx2.arc(0, 0, 46, 0, Math.PI * 2);
  ctx2.fill();
  // Wings, flapping.
  ctx2.fillStyle = "rgba(220, 235, 255, 0.75)";
  ctx2.save();
  ctx2.rotate(p.faceAngle + Math.PI / 2);
  ctx2.beginPath();
  ctx2.ellipse(-9, -4 - flap * 4, 7, 11, -0.5, 0, Math.PI * 2);
  ctx2.ellipse(9, -4 - flap * 4, 7, 11, 0.5, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.restore();
  // Body.
  ctx2.fillStyle = "#ffcf3d";
  ctx2.beginPath();
  ctx2.arc(0, 0, 12, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.fillStyle = "#2b2118";
  ctx2.beginPath();
  ctx2.arc(0, 0, 12, 0, Math.PI * 2);
  ctx2.stroke();
  // Eyes looking where Luma faces.
  const ex = Math.cos(p.faceAngle) * 4;
  const ey = Math.sin(p.faceAngle) * 4;
  ctx2.fillStyle = "#141824";
  ctx2.beginPath();
  ctx2.arc(ex - 3, ey - 3, 2.2, 0, Math.PI * 2);
  ctx2.arc(ex + 3, ey - 3, 2.2, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(8, 10, 16, 0.82)";
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = "#e8d9a8";
  ctx.font = "bold 14px Georgia, serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const taken = game.keycards.filter((c) => c.taken).length;
  ctx.fillText(`Keycards ${taken}/3`, 12, 18);
  // Keycard pips.
  game.keycards.forEach((card, i) => {
    ctx.fillStyle = card.taken ? card.color : "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(118 + i * 22, 17, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  // Timer.
  const t = game.time;
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(Math.floor(t % 60)).padStart(2, "0");
  ctx.fillStyle = "#e8d9a8";
  ctx.fillText(`Time ${mm}:${ss}`, 210, 18);
  // Alert meter: the hottest warden.
  const maxAlert = Math.max(0, ...game.guards.map((g) => g.alert));
  ctx.fillStyle = "#e8d9a8";
  ctx.fillText("Alert", 330, 18);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(378, 11, 120, 12);
  ctx.fillStyle = maxAlert >= CHASE_TRIGGER ? "#ff5040" : "#ffd65a";
  ctx.fillRect(378, 11, (120 * maxAlert) / 100, 12);
  // Visibility + detections.
  const label = visibilityLabel();
  ctx.fillStyle = label === "HUNTED" ? "#ff5040" : label === "SEEN" ? "#ffb347" : "#9fe6a0";
  ctx.fillText(label, 520, 18);
  ctx.fillStyle = "#e8d9a8";
  ctx.fillText(`Spotted ${game.detections}x`, 700, 18);
  ctx.fillStyle = "#9aa3b5";
  ctx.font = "12px Georgia, serif";
  ctx.textAlign = "right";
  ctx.fillText("M sound", W - 12, 18);
  ctx.restore();
}

function drawHint() {
  ctx.save();
  ctx.fillStyle = "rgba(8, 10, 16, 0.7)";
  ctx.fillRect(0, H - 26, W, 26);
  ctx.fillStyle = "#9aa3b5";
  ctx.font = "12px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const remaining = game.keycards.filter((c) => !c.taken).length;
  const goal = remaining > 0 ? `Find ${remaining} more keycard${remaining > 1 ? "s" : ""}, then reach the EXIT.` : "All keycards found — reach the EXIT!";
  ctx.fillText(`WASD / arrows to move · Shift to sneak · click to walk there · R restart — ${goal}`, W / 2, H - 13);
  ctx.restore();
}

function panelBox(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(10, 12, 20, 0.88)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#c8b06a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

function drawStart(time) {
  ctx.fillStyle = "#10131d";
  ctx.fillRect(0, 0, W, H);
  // A few drifting fireflies for mood.
  for (let i = 0; i < 14; i++) {
    const fx = (i * 173 + Math.sin(time * 0.4 + i * 2.1) * 30 + W) % W;
    const fy = (i * 97 + Math.cos(time * 0.3 + i * 1.3) * 24 + H) % H;
    ctx.fillStyle = `rgba(255, 214, 90, ${0.25 + 0.2 * Math.sin(time * 2 + i)})`;
    ctx.beginPath();
    ctx.arc(fx, fy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  panelBox(180, 110, 600, 470);
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffcf3d";
  ctx.font = "bold 52px Georgia, serif";
  ctx.fillText("EMBER ARCHIVE", W / 2, 180);
  ctx.fillStyle = "#e8d9a8";
  ctx.font = "italic 20px Georgia, serif";
  ctx.fillText("a firefly stealth heist", W / 2, 216);
  ctx.fillStyle = "#d7dce8";
  ctx.font = "16px Georgia, serif";
  const lines = [
    "You are Luma, a firefly thief in the midnight archive.",
    "Pocket the Sun, Moon and Star keycards,",
    "then slip out through the moonlit EXIT — unseen.",
    "",
    "Wardens patrol with golden vision cones. If one spots you,",
    "its alert meter climbs and it gives chase. Bushes hide you,",
    "crates block their sight, and sneaking keeps you dim.",
    "If a warden touches you, the heist is over.",
    "",
    "Move: WASD or arrow keys (or click a spot to walk there)",
    "Sneak: hold Shift (slower, harder to spot)",
    "Restart: R      Sound: M",
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 258 + i * 24));
  ctx.fillStyle = "#ffcf3d";
  ctx.font = "bold 20px Georgia, serif";
  const blink = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText("Press ENTER or click to begin", W / 2, 540);
  ctx.restore();
}

function drawEndScreen(won, time) {
  ctx.fillStyle = "rgba(8, 10, 16, 0.72)";
  ctx.fillRect(0, 0, W, H);
  panelBox(240, 200, 480, 300);
  ctx.save();
  ctx.textAlign = "center";
  if (won) {
    ctx.fillStyle = "#9fe6a0";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText("CLEAN GETAWAY!", W / 2, 268);
    ctx.fillStyle = "#e8d9a8";
    ctx.font = "18px Georgia, serif";
    ctx.fillText("Luma slips into the night with all three keycards.", W / 2, 306);
  } else {
    ctx.fillStyle = "#ff5040";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText("CAUGHT!", W / 2, 268);
    ctx.fillStyle = "#e8d9a8";
    ctx.font = "18px Georgia, serif";
    ctx.fillText(`Warden ${game.caughtBy ?? "??"} grabbed Luma in the dark.`, W / 2, 306);
  }
  const mm = String(Math.floor(game.time / 60)).padStart(2, "0");
  const ss = String(Math.floor(game.time % 60)).padStart(2, "0");
  ctx.fillStyle = "#d7dce8";
  ctx.font = "18px Georgia, serif";
  ctx.fillText(`Time: ${mm}:${ss}`, W / 2, 350);
  ctx.fillText(`Times spotted: ${game.detections}`, W / 2, 380);
  ctx.fillText(`Keycards: ${game.keycards.filter((c) => c.taken).length}/3`, W / 2, 410);
  ctx.fillStyle = "#ffcf3d";
  ctx.font = "bold 20px Georgia, serif";
  const blink = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText("Press R or click to play again", W / 2, 462);
  ctx.restore();
}

function draw(time) {
  ctx.clearRect(0, 0, W, H);
  if (game.state === "start") {
    drawStart(time);
    return;
  }
  drawLevel(ctx, time);
  for (const guard of game.guards) guard.drawCone(ctx);
  drawKeycards(ctx, time);
  drawPlayer(ctx);
  // Bushes over a hiding player, so the hiding reads visually.
  const p = game.player;
  if (p) {
    const col = Math.floor(p.x / TILE);
    const row = Math.floor(p.y / TILE);
    if (isBush(col, row)) drawBushTile(ctx, col, row, 0.85);
  }
  for (const guard of game.guards) guard.draw(ctx);
  // Click-to-move marker.
  if (game.clickTarget && game.state === "playing") {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 207, 61, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(game.clickTarget.x, game.clickTarget.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(game.clickTarget.x - 12, game.clickTarget.y);
    ctx.lineTo(game.clickTarget.x + 12, game.clickTarget.y);
    ctx.moveTo(game.clickTarget.x, game.clickTarget.y - 12);
    ctx.lineTo(game.clickTarget.x, game.clickTarget.y + 12);
    ctx.stroke();
    ctx.restore();
  }
  drawHud();
  drawHint();
  if (game.state === "won") drawEndScreen(true, time);
  if (game.state === "lost") drawEndScreen(false, time);
}

// ---- main loop -------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(now / 1000);
  requestAnimationFrame(frame);
}

// Debug / automation hook used by our own screenshot and playtest scripts.
// It only exposes the running game state; it is not part of the game itself.
window.__game = {
  game,
  start: startGame,
  reset: resetGame,
  teleport(x, y) {
    if (game.player) {
      game.player.x = x;
      game.player.y = y;
      game.clickTarget = null;
    }
  },
  collectAll() {
    for (const c of game.keycards) c.taken = true;
  },
  forceAlert() {
    for (const g of game.guards) {
      g.alert = 90;
      g.state = "chase";
      g.lastSeen = { x: game.player.x, y: game.player.y };
    }
    game.detections += 1;
  },
};

requestAnimationFrame(frame);
