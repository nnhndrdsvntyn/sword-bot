// === CONFIG ===
let BOT_Mode = "Find-Kill-NPCs-Players"; // Options: 'Free-XP' or 'Find-Kill-NPCs-Players'
let farmAdXP = true; // Toggle bonus XP farming
let reconnect_aboveScore = false; // Reset bots if score > SPAWN_SCORE

const SPAWN_SCORE = 500_000;
const servers = ["na-3"];
const botsPerServer = 50;

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
const skinNumbers = [
  71, 38, 39, 40, 36, 37, 41, 42, 51, 52, 74, 75, 44, 46, 55, 56, 72, 73,
];

const heartColors = ["❤️", "🧡", "💛", "💚", "💙", "💜"];
let chatColorIndex = 0;

// === Love message options ===
const loveMessages = [
  "take my love",
  "spreading love",
  "get some love",
  "free love",
];
let currentLoveMessage = loveMessages[0],
  loveMessageSwitchTime = Date.now() + 5000;

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
  // Pick a random heart color for the username
  const heart = heartColors[Math.floor(Math.random() * heartColors.length)];
  // Pick a random skin number for this bot
  const skin = skinNumbers[Math.floor(Math.random() * skinNumbers.length)];
  const bot = {
    server,
    name: `Lib-Bot #${index} ${heart}`,
    skin,
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

  function sendSkin() {
    setTimeout(() => {
      socket.emit("buySkin", { number: bot.skin });
      socket.emit("useItem", { number: bot.skin });
    }, 1000);
  }
  socket.on("connect", () => {
    socket.emit("gameModeReceived", { status: true });
    sendSkin();
  });
  // Removed socket.on("reconnect", sendSkin); as reconnect is handled by custom logic

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

// === Chat message animation loop (100ms) ===
setInterval(() => {
  if (Date.now() > loveMessageSwitchTime) {
    let prev = currentLoveMessage;
    while (currentLoveMessage === prev && loveMessages.length > 1)
      currentLoveMessage =
        loveMessages[(Math.random() * loveMessages.length) | 0];
    loveMessageSwitchTime = Date.now() + 5000;
  }
  chatColorIndex = (chatColorIndex + 1) % heartColors.length;
}, 1);

// === Main bot behavior loop (every tick) ===
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
    const bot = bots[i],
      self = bot.list.players[bot.socket.id];
    if (!self) continue;
    if (reconnect_aboveScore && self.e > SPAWN_SCORE && !bot._queuedReset) {
      bot._queuedReset = true;
      setTimeout(() => {
        const idx = bots.indexOf(bot);
        if (idx !== -1) bots.splice(idx, 1);
        const roamIdx = roamData.findIndex((r) => r.bot === bot);
        if (roamIdx !== -1) roamData.splice(roamIdx, 1);
        bot.socket.disconnect();
        setTimeout(() => createBot(bot.server, i + 1), 1);
      }, 1);
      continue;
    }
    bot.bonusXPTimer >= 20
      ? (self.g === 0 && getbonusXP(bot.socket), (bot.bonusXPTimer = 1))
      : bot.bonusXPTimer++;
    let target = null,
      targetIsPlayer = false,
      minDistSq = 1 / 0;
    if (BOT_Mode === "Free-XP") {
      for (const player of globalPlayers) {
        const dx = player.b - self.b,
          dy = player.c - self.c,
          distSq = dx * dx + dy * dy;
        if (distSq < minDistSq)
          (minDistSq = distSq), (target = player), (targetIsPlayer = true);
      }
      if (target) moveSmartSimpleSteer(bot, target.b, target.c, self);
      else {
        const roam = roamData[i],
          dx = roam.x - self.b,
          dy = roam.y - self.c,
          distSq = dx * dx + dy * dy;
        if (distSq < 10000 || now > roam.nextChangeTime)
          (roam.x = Math.random() * 10000),
            (roam.y = Math.random() * 10000),
            (roam.nextChangeTime = now + 6000 + Math.random() * 4000);
        moveSmartSimpleSteer(bot, roam.x, roam.y, self);
      }
      bot.socket.emit("keyPressX", { inputId: "leftButton", state: 0 });
    } else if (BOT_Mode === "Find-Kill-NPCs-Players") {
      for (const npc of globalNPCs) {
        const dx = npc.b - self.b,
          dy = npc.c - self.c,
          distSq = dx * dx + dy * dy;
        if (distSq < minDistSq)
          (minDistSq = distSq), (target = npc), (targetIsPlayer = false);
      }
      for (const player of globalPlayers) {
        const dx = player.b - self.b,
          dy = player.c - self.c,
          distSq = dx * dx + dy * dy;
        if (distSq < minDistSq)
          (minDistSq = distSq), (target = player), (targetIsPlayer = true);
      }
      if (target) {
        moveSmartSimpleSteer(bot, target.b, target.c, self);
        const swingDist = getSwingDistance(self.h),
          inSight = hasLineOfSight(bot, self.b, self.c, target.b, target.c),
          swing = minDistSq <= swingDist * swingDist && inSight;
        bot.socket.emit("keyPressX", {
          inputId: "leftButton",
          state: swing ? 1 : 0,
        });
      } else {
        const roam = roamData[i],
          dx = roam.x - self.b,
          dy = roam.y - self.c,
          distSq = dx * dx + dy * dy;
        if (distSq < 10000 || now > roam.nextChangeTime)
          (roam.x = Math.random() * 10000),
            (roam.y = Math.random() * 10000),
            (roam.nextChangeTime = now + 6000 + Math.random() * 4000);
        moveSmartSimpleSteer(bot, roam.x, roam.y, self);
        bot.socket.emit("keyPressX", { inputId: "leftButton", state: 0 });
      }
    }
    let msg = currentLoveMessage;
    if (targetIsPlayer && target && target.d) msg = `come love, ${target.d}`;
    bot.socket.emit("keyPressX", {
      inputId: "chatMessage",
      state: `${msg} ${heartColors[chatColorIndex]}`,
    });
  }
}, 1000 / 30);
