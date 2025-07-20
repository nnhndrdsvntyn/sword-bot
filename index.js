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
const botsPerServer = 150;
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
      bot.list.npcs = {};
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

    if (localPlayer.pausedTimer === 5 && localPlayer.e >= 500_000) {
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
    if (!self) continue;

    if (bot.bonusXPTimer >= 20) {
      if (self.g === 0) {
        getbonusXP(bot.socket);
      }
      bot.bonusXPTimer = 1;
    } else {
      bot.bonusXPTimer++;
    }

    let closest = null;
    let minDistSq = Infinity;

    for (const player of Object.values(bot.list.players)) {
      if (player.a === bot.socket.id) continue;
      if (allBotIds.has(player.a)) continue;

      const dx = player.b - self.b;
      const dy = player.c - self.c;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = player;
      }
    }

    const now = Date.now();

    if (closest) {
      moveToward(bot, closest.b, closest.c, self);

      if (now - bot.lastMessageTime > bot.messageCooldown) {
        const messageTemplate =
          chatMessages[Math.floor(Math.random() * chatMessages.length)];
        const dValue = closest.d || "";
        bot.currentMessage = messageTemplate.replace("${dValue}", dValue);

        bot.socket.emit("keyPressX", {
          inputId: "chatMessage",
          state: bot.currentMessage,
        });

        bot.lastMessageTime = now;
        bot.messageCooldown = 2000 + Math.floor(Math.random() * 3000);
      }
    } else {
      const roam = roamData[i];
      const dx = self.b - 5000;
      const dy = self.c - 5000;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      if (distFromCenter > 1000) {
        bot.socket.emit("keyPressX", {
          inputId: "chatMessage",
          state: "⚡ Heading to center...",
        });

        moveToward(bot, 5000, 5000, self);
      } else {
        if (now > roam.nextChangeTime) {
          let newX, newY, valid;
          do {
            newX = Math.random() * 10000;
            newY = Math.random() * 10000;
            valid = true;

            for (let j = 0; j < roamData.length; j++) {
              if (i === j) continue;
              const other = roamData[j];
              if (other.bot.server !== bot.server) continue;

              const dx = newX - other.x;
              const dy = newY - other.y;
              if (dx * dx + dy * dy < 100 * 100) {
                valid = false;
                break;
              }
            }
          } while (!valid);

          roam.x = newX;
          roam.y = newY;
          roam.nextChangeTime = now + 6000 + Math.random() * 4000;
        }

        bot.socket.emit("keyPressX", {
          inputId: "chatMessage",
          state: "👀 Looking for targets...",
        });

        moveToward(bot, roam.x, roam.y, self);
      }
    }
  }
}, 250);

function getbonusXP(socket) {
  socket.emit("extraBonus", { status: true });
  setTimeout(() => {
    socket.emit("extraBonus", { status: true });
  }, 100);
}
