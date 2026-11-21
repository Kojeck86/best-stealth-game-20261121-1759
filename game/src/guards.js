// Ember Archive — warden guards: patrol, vision cones, alert and chase.
//
// A warden walks its patrol route. When you step into its vision cone with
// a clear line of sight, its alert meter climbs; at full alert it gives
// chase. Break line of sight and stay quiet and the meter drains away.

import { TILE, blocksSight, hasLineOfSight, isBush, moveCircle } from "./level.js";

export const VISION_RANGE = 230;
export const VISION_HALF_ANGLE = (35 * Math.PI) / 180;
export const CHASE_TRIGGER = 75;
export const CHASE_RELEASE = 25;

export class Guard {
  constructor(name, waypoints, patrolSpeed = 68) {
    this.name = name;
    this.waypoints = waypoints; // [{x, y}, ...] in pixels
    this.x = waypoints[0].x;
    this.y = waypoints[0].y;
    this.targetIndex = 1 % waypoints.length;
    this.patrolSpeed = patrolSpeed;
    this.chaseSpeed = 168;
    this.angle = 0; // facing direction, radians
    this.alert = 0; // 0..100
    this.state = "patrol"; // 'patrol' | 'chase'
    this.lastSeen = null;
    this.pauseTimer = 0;
  }

  // Can this guard see the player right now?
  canSee(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.rangeFor(player)) return false;
    // A player crouched in a bush is invisible unless the warden is close.
    const inBush = isBush(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (inBush && dist > 46) return false;
    const toPlayer = Math.atan2(dy, dx);
    let diff = toPlayer - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > VISION_HALF_ANGLE) return false;
    return hasLineOfSight(this.x, this.y, player.x, player.y);
  }

  rangeFor(player) {
    return player.sneaking ? VISION_RANGE * 0.6 : VISION_RANGE;
  }

  update(dt, player) {
    const sees = this.canSee(player);
    if (sees) {
      this.alert = Math.min(100, this.alert + 62 * dt);
      this.lastSeen = { x: player.x, y: player.y };
    } else if (this.state === "chase") {
      this.alert = Math.max(0, this.alert - 12 * dt);
    } else {
      this.alert = Math.max(0, this.alert - 30 * dt);
    }

    const wasChasing = this.state === "chase";
    if (!wasChasing && this.alert >= CHASE_TRIGGER) {
      this.state = "chase";
      return "spotted"; // the caller plays the sting and counts a detection
    }
    if (wasChasing && this.alert < CHASE_RELEASE) {
      this.state = "patrol";
      this.targetIndex = this.nearestWaypoint();
      // The warden lost you: it stops, looks toward where it last saw
      // you for a beat, then resumes its route.
      this.pauseTimer = 1.2;
      if (this.lastSeen) this.angle = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
    }

    if (this.state === "chase" && this.lastSeen) {
      this.moveToward(this.lastSeen.x, this.lastSeen.y, this.chaseSpeed, dt);
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (d < 26) return "caught";
    } else {
      this.patrol(dt);
    }
    return sees ? "seeing" : null;
  }

  nearestWaypoint() {
    let best = 0;
    let bestD = Infinity;
    this.waypoints.forEach((w, i) => {
      const d = Math.hypot(w.x - this.x, w.y - this.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  patrol(dt) {
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      return;
    }
    const target = this.waypoints[this.targetIndex];
    const arrived = this.moveToward(target.x, target.y, this.patrolSpeed, dt);
    if (arrived) {
      this.targetIndex = (this.targetIndex + 1) % this.waypoints.length;
      this.pauseTimer = 0.7; // a beat to look around at each waypoint
    }
  }

  // Step toward (tx, ty) at speed; returns true when arrived.
  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    this.angle = Math.atan2(dy, dx);
    const moved = moveCircle({ x: this.x, y: this.y }, nx - this.x, ny - this.y, 15);
    this.x = moved.x;
    this.y = moved.y;
    return dist - step < 4;
  }

  // The cone is raycast: each ray stops at the first wall or crate, so the
  // light never leaks through solid shelves the way a plain arc would.
  castRay(angle, maxDist) {
    const step = 6;
    let d = 0;
    while (d < maxDist) {
      d += step;
      const x = this.x + Math.cos(angle) * d;
      const y = this.y + Math.sin(angle) * d;
      if (blocksSight(Math.floor(x / TILE), Math.floor(y / TILE))) {
        const back = d - step;
        return { x: this.x + Math.cos(angle) * back, y: this.y + Math.sin(angle) * back };
      }
    }
    return { x: this.x + Math.cos(angle) * maxDist, y: this.y + Math.sin(angle) * maxDist };
  }

  drawCone(ctx) {
    const range = VISION_RANGE;
    const chasing = this.state === "chase";
    const rays = 26;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i = 0; i <= rays; i++) {
      const a = this.angle - VISION_HALF_ANGLE + ((2 * VISION_HALF_ANGLE) * i) / rays;
      const end = this.castRay(a, range);
      ctx.lineTo(end.x, end.y);
    }
    ctx.closePath();
    ctx.fillStyle = chasing ? "rgba(255, 70, 60, 0.28)" : "rgba(255, 214, 90, 0.16)";
    ctx.fill();
    ctx.strokeStyle = chasing ? "rgba(255, 70, 60, 0.5)" : "rgba(255, 214, 90, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  draw(ctx) {
    // Body: a round brass warden-bot with a visor that points where it looks.
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(2, 4, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.state === "chase" ? "#8c2f26" : "#4a5468";
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c8b06a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(this.angle);
    ctx.fillStyle = this.state === "chase" ? "#ff5040" : "#ffd65a";
    ctx.beginPath();
    ctx.arc(7, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1d26";
    ctx.fillRect(10, -2, 7, 4);
    ctx.restore();

    // Alert meter above the warden's head.
    if (this.alert > 2) {
      const w = 34;
      const x = this.x - w / 2;
      const y = this.y - 30;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - 1, y - 1, w + 2, 7);
      ctx.fillStyle = this.state === "chase" ? "#ff5040" : "#ffd65a";
      ctx.fillRect(x, y, (w * this.alert) / 100, 5);
    }
  }
}

// The four wardens of the archive, with their patrol routes in tile coords.
export function makeGuards() {
  const pt = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });
  return [
    new Guard("Bramble", [pt(7, 2), pt(12, 2)], 72),
    new Guard("Thistle", [pt(7, 6), pt(12, 6)], 66),
    new Guard("Nettle", [pt(7, 10), pt(12, 10)], 78),
    new Guard("Rowan", [pt(16, 1), pt(16, 13)], 60),
  ];
}
