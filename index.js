// === CONFIG ===
let BOT_Mode = "Free-XP"; // Options: 'Free-XP' or 'Find-Kill-NPCs-Players'
let farmAdXP = true; // Toggle bonus XP farming
let reconnect_aboveScore = true; // Reset bots if score > SPAWN_SCORE

const SPAWN_SCORE = 500_000;
const servers = ["na-4"]
const botsPerServer = 150;

// === EXPRESS SERVER ===
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(port, () => console.log(`Express server running on port ${port}`));

// === DEPENDENCIES ===
const io = require("socket.io-client");

const bots = [];
const roamData = [];

function getSwingDistance(h) {
  return h < 1 ? 150 : h > 35 ? 245 : 150 + (h - 1) * 10;
}

// === Smooth steering around obstacles ===
function moveSmartSimpleSteer(bot, targetX, targetY, self) {
  let dx = targetX - self.b;
  let dy = targetY - self.c;
  let angle = Math.atan2(dy, dx);

  for (const obs of Object.values(bot.list.decorations)) {
    if (obs.type !== 1 && obs.type !== 3) continue;

    const radius = obs.type === 1 ? 215 : 165;
    const avoidRadius = radius + 100;

    const ox = obs.x - self.b;
    const oy = obs.y - self.c;
    const distSq = ox * ox + oy * oy;

    if (distSq < avoidRadius * avoidRadius) {
      const dist = Math.sqrt(distSq);
      const nx = ox / dist;
      const ny = oy / dist;

      const mvx = Math.cos(angle);
      const mvy = Math.sin(angle);

      const cross = mvx * ny - mvy * nx;
      const push = (avoidRadius - dist) / avoidRadius;
      const bendAngle = 3 * push;

      angle += cross > 0 ? -bendAngle : bendAngle;
      break;
    }
  }

  let degrees = (angle * 180) / Math.PI;
  if (degrees < 0) degrees += 360;

  bot.socket.emit("keyPressX", { inputId: "mouseDistance", state: 1 });
  bot.socket.emit("keyPressX", { inputId: "angle", state: degrees });
  bot.socket.emit("keyPressX", { inputId: "rightButton", state: 1 });
}

function hasLineOfSight(bot, fromX, fromY, toX, toY) {
  for (const obs of Object.values(bot.list.decorations)) {
    if (obs.type !== 1 && obs.type !== 3) continue;
    const radius = obs.type === 1 ? 215 : 165;
    if (lineIntersectsCircle(fromX, fromY, toX, toY, obs.x, obs.y, radius)) {
      return false;
    }
  }
  return true;
}

function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const acX = cx - x1;
  const acY = cy - y1;
  const abX = x2 - x1;
  const abY = y2 - y1;
  const abSq = abX * abX + abY * abY;
  const ac_ab = acX * abX + acY * abY;
  const t = Math.max(0, Math.min(1, ac_ab / abSq));
  const closestX = x1 + abX * t;
  const closestY = y1 + abY * t;
  const distX = closestX - cx;
  const distY = closestY - cy;
  return distX * distX + distY * distY <= r * r;
}

function getbonusXP(socket) {
  if (!farmAdXP) return;
  socket.emit("extraBonus", { status: true });
  setTimeout(() => socket.emit("extraBonus", { status: true }), 100);
}

function createBot(server, index) {
  const bot = {
    server,
    name: `${server.toUpperCase()} BOT #${index}`,
    list: {
      players: {},
      npcs: {},
      mobs: {},
      decorations: {},
    },
    hasInit: false,
    bonusXPTimer: 20,
    _queuedReset: false,
  };
  bots.push(bot);

  roamData.push({
    bot,
    x: Math.random() * 10000,
    y: Math.random() * 10000,
    nextChangeTime: Date.now() + 6000 + Math.random() * 4000,
  });

  const socket = io(`https://${server}.swordonline.io`);
  bot.socket = socket;

  socket.on("connect", () => {
    socket.emit("gameModeReceived", { status: true });
  });

  socket.on("init", (data) => {
    if (!bot.hasInit) {
      bot.list.decorations = data.decoration;
      bot.hasInit = true;
    }
  });

  socket.on("update", (data) => {
    const players = {};
    for (const obj of data.player) {
      const id = obj.a;
      const prev = bot.list.players[id]?.pausedTimer ?? 0;
      obj.pausedTimer = obj.g === 1 ? 0 : prev;
      players[id] = obj;
    }
    bot.list.players = players;
    bot.list.npcs = Object.fromEntries(data.npc.map((e) => [e.a, e]));
    bot.list.mobs = Object.fromEntries(data.mob.map((e) => [e.a, e]));
  });

  socket.on("disconnect", () => {
    const idx = bots.indexOf(bot);
    if (idx !== -1) bots.splice(idx, 1);
    const roamIdx = roamData.findIndex((r) => r.bot === bot);
    if (roamIdx !== -1) roamData.splice(roamIdx, 1);
  });

  setInterval(() => {
    for (const id in bot.list.players) {
      const player = bot.list.players[id];
      if (player && player.g === 0 && player.pausedTimer < 5) {
        player.pausedTimer++;
      }
    }
  }, 1000);
}

servers.forEach((server) => {
  for (let i = 1; i <= botsPerServer; i++) createBot(server, i);
});

setInterval(() => {
  for (const bot of bots) {
    const self = bot.list.players[bot.socket.id];
    if (self && self.pausedTimer === 5 && self.e >= SPAWN_SCORE) {
      bot.socket.emit("signInY", { username: bot.name });
    }
  }
}, 1000);

// === Behavior Loop ===
setInterval(() => {
  const now = Date.now();
  const allBotIDs = new Set(bots.map((b) => b.socket.id));
  const globalPlayers = [];
  const globalNPCs = [];

  for (const bot of bots) {
    for (const p of Object.values(bot.list.players)) {
      if (!allBotIDs.has(p.a)) globalPlayers.push(p);
    }
    for (const n of Object.values(bot.list.npcs)) {
      globalNPCs.push(n);
    }
  }

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const self = bot.list.players[bot.socket.id];
    if (!self) continue;

    // === Reset bot if score exceeds limit ===
    if (reconnect_aboveScore && self.e > SPAWN_SCORE && !bot._queuedReset) {
      bot._queuedReset = true;

      setTimeout(() => {
        const socket = bot.socket;
        const idx = bots.indexOf(bot);
        if (idx !== -1) bots.splice(idx, 1);
        const roamIdx = roamData.findIndex((r) => r.bot === bot);
        if (roamIdx !== -1) roamData.splice(roamIdx, 1);
        socket.disconnect();

        setTimeout(() => {
          createBot(bot.server, i + 1);
        }, 1000);
      }, 500);

      continue;
    }

    if (bot.bonusXPTimer >= 20) {
      if (self.g === 0) getbonusXP(bot.socket);
      bot.bonusXPTimer = 1;
    } else {
      bot.bonusXPTimer++;
    }

    if (BOT_Mode === "Free-XP") {
      let closest = null;
      let minDistSq = Infinity;
      for (const player of globalPlayers) {
        const dx = player.b - self.b;
        const dy = player.c - self.c;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = player;
        }
      }

      if (closest) {
        moveSmartSimpleSteer(bot, closest.b, closest.c, self);
      } else {
        const roam = roamData[i];
        const dx = roam.x - self.b;
        const dy = roam.y - self.c;
        const distSq = dx * dx + dy * dy;

        if (distSq < 10000 || now > roam.nextChangeTime) {
          roam.x = Math.random() * 10000;
          roam.y = Math.random() * 10000;
          roam.nextChangeTime = now + 6000 + Math.random() * 4000;
        }

        moveSmartSimpleSteer(bot, roam.x, roam.y, self);
      }

      bot.socket.emit("keyPressX", { inputId: "leftButton", state: 0 });
    } else if (BOT_Mode === "Find-Kill-NPCs-Players") {
      let closest = null;
      let minDistSq = Infinity;

      for (const npc of globalNPCs) {
        const dx = npc.b - self.b;
        const dy = npc.c - self.c;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = npc;
        }
      }

      for (const player of globalPlayers) {
        const dx = player.b - self.b;
        const dy = player.c - self.c;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = player;
        }
      }

      if (closest) {
        moveSmartSimpleSteer(bot, closest.b, closest.c, self);
        const swingDist = getSwingDistance(self.h);
        const inSight = hasLineOfSight(
          bot,
          self.b,
          self.c,
          closest.b,
          closest.c,
        );
        const swing = minDistSq <= swingDist * swingDist && inSight;
        bot.socket.emit("keyPressX", {
          inputId: "leftButton",
          state: swing ? 1 : 0,
        });
      } else {
        const roam = roamData[i];
        const dx = roam.x - self.b;
        const dy = roam.y - self.c;
        const distSq = dx * dx + dy * dy;

        if (distSq < 10000 || now > roam.nextChangeTime) {
          roam.x = Math.random() * 10000;
          roam.y = Math.random() * 10000;
          roam.nextChangeTime = now + 6000 + Math.random() * 4000;
        }

        moveSmartSimpleSteer(bot, roam.x, roam.y, self);
        bot.socket.emit("keyPressX", { inputId: "leftButton", state: 0 });
      }
    }
  }
}, 250);
