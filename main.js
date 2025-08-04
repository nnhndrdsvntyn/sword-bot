const { fork } = require("child_process");

const TARGETS = ["na-3"]; // add more if you want
const INSTANCES_PER_TARGET = 2; // Increase to 5–10 per server if needed

for (const target of TARGETS) {
  for (let i = 0; i < INSTANCES_PER_TARGET; i++) {
    fork("cannon.js", [target]);
  }
}
