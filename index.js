const https = require("https");

const SERVERS = ["na", "na-7", "na-2", "na-3", "na-4", "na-5", "na-6", "na-8"];
const connections = [];

function pollAll() {
  SERVERS.forEach((server) => {
    const url = `https://${server}.swordonline.io/socket.io/?EIO=3&transport=polling`;
    const req = https.get(url, (res) => {
      // Just consume data, but do NOT destroy socket or end connection
      res.on("data", () => {});
      res.on("end", () => {});
    });
    req.on("error", () => {});
    connections.push(req); // Keep request object to keep connection alive
  });

  setImmediate(pollAll);
}

pollAll();
