const url = "https://playem.io/";

function startClient(id) {
  setInterval(() => {
    fetch(url)
      .then((res) => res.text())
      .then((html) => {
        const sizeMB = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(2);
      })
      .catch(() => {});
  }, 1);
}

// Start 10 clients
for (let i = 1; i <= 1; i++) {
  startClient(i);
}
