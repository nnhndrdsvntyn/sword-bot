const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});

const io = require("socket.io-client");

const servers = ["na-4"];
const botsPerServer = 75;
const autoRespawn = true;
const autoAttack = true;

function moveToward(bot, targetX, targetY, p) {
  let dx = targetX - p.b;
  let dy = targetY - p.c;
  let angle = Math.atan2(dy, dx);

  for (const obs of Object.values(bot.list.decorations)) {
    if (obs.type !== 1 && obs.type !== 3) continue;
    const size = obs.type === 1 ? 215 : 165;
    const avoidRadius = size + 40;

    const distX = obs.x - p.b;
    const distY = obs.y - p.c;
    const distSq = distX * distX + distY * distY;

    if (distSq <= avoidRadius * avoidRadius) {
      const obsAngle = Math.atan2(distY, distX);
      const angleDiff = angle - obsAngle;
      const turnDir = angleDiff > 0 ? 1 : -1;
      angle += turnDir * 2;
    }
  }

  let degrees = (angle * 180) / Math.PI;
  if (degrees < 0) degrees += 360;

  bot.socket.emit("keyPressX", { inputId: "mouseDistance", state: 1 });
  bot.socket.emit("keyPressX", { inputId: "angle", state: degrees });
  bot.socket.emit("keyPressX", { inputId: "rightButton", state: 1 });
}

const bots = [];
const roamData = [];

const chatMessages = [
  "FREE XP!!!!",
  "KILL ME FOR XP!! 🤑",
  "EZ LEVELS! 📈",
  "KILL ME, ${dValue}",
  "MADE BY LIBERATION",
];

servers.forEach((server) => {
  for (let i = 1; i <= botsPerServer; i++) {
    botName = `${server.toUpperCase()} FREE XP!`;
    const bot = {
      server,
      name: botName,
      list: {
        players: {},
        npcs: {},
        mobs: {},
        decorations: {},
      },
      hasInit: false,
      bonusXPTimer: 20,
      messageCooldown: 0,
      lastMessageTime: 0,
      currentMessage: "",
    };

    bots.push(bot);

    roamData.push({
      bot,
      x: Math.random() * 10000,
      y: Math.random() * 10000,
      nextChangeTime: Date.now() + 6000 + Math.random() * 4000,
    });

    bot.socket = io(`https://${server}.swordonline.io`);

    bot.socket.on("connect", () => {
      bot.socket.emit("gameModeReceived", { status: true });
    });

    bot.socket.on("init", (data) => {
      if (!bot.hasInit) {
        bot.list.decorations = data.decoration;
        bot.hasInit = true;
      }
    });

    bot.socket.on("update", (data) => {
      const newPlayers = {};
      for (const obj of data.player) {
        const id = obj.a;
        const oldPausedTimer = bot.list.players[id]?.pausedTimer ?? 0;
        obj.pausedTimer = obj.g === 1 ? 0 : oldPausedTimer;
        newPlayers[id] = obj;
      }

      bot.list.players = newPlayers;
      bot.list.npcs = {}; // no npc tracking
      bot.list.mobs = {};
    });

    setInterval(() => {
      for (const id in bot.list.players) {
        const player = bot.list.players[id];
        if (!player) continue;
        if (player.g === 0 && player.pausedTimer < 5) {
          player.pausedTimer++;
        }
      }
    }, 1000);
  }
});

setInterval(() => {
  if (!autoRespawn) return;

  for (const bot of bots) {
    const localPlayer = bot.list.players[bot.socket.id];
    if (!localPlayer) continue;

    if (localPlayer.pausedTimer === 5 && localPlayer.h >= 31) {
      bot.socket.emit("signInY", { username: bot.name });
    }
  }
}, 1000);

setInterval(() => {
  if (!autoAttack) return;

  const allBotIds = new Set(bots.map((b) => b.socket.id));

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    const self = bot.list.players[bot.socket.id];
