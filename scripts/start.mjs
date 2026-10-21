import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("../", import.meta.url)));
if (Number(process.versions.node.split(".")[0]) < 24) {
  console.error(
    "Gleam requires Node.js 24 or newer. Install Node.js 24 LTS, close this window, then try again.",
  );
  process.exit(1);
}
if (!existsSync(resolve("dist/index.html"))) {
  console.error(
    "The frontend build is missing. Run SETUP-WINDOWS.cmd to build it first.",
  );
  process.exit(1);
}
const child = spawn(process.execPath, ["server/index.mjs"], {
  stdio: "inherit",
});
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
