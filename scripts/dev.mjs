import { spawn } from "node:child_process";
import { resolve } from "node:path";
if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error("Install Node.js 24 LTS before running Gleam.");
  process.exit(1);
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill("SIGTERM"));
  process.exitCode = code;
}
const backend = spawn(process.execPath, ["server/index.mjs"], {
  cwd: resolve("."),
  env: { ...process.env, PORT: "4000", HOST: "127.0.0.1" },
  stdio: "inherit",
});
children.push(backend);
const frontend = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "4173"],
  { cwd: resolve("."), stdio: "inherit" },
);
children.push(frontend);
children.forEach((child) => {
  child.on("error", (e) => {
    console.error(e.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
