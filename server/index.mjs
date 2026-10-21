import { getConfig } from "./config.mjs";
import { createApp } from "./app.mjs";
try {
  const config = getConfig();
  const app = createApp(config);
  app.server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? `Port ${config.port} is busy. Close the other app or change PORT in .env.`
        : e.message,
    );
    process.exitCode = 1;
  });
  app.server.listen(config.port, config.host, () =>
    console.log(
      `\nGleam is ready: http://localhost:${config.port}\n${config.demo ? "Local demo mode · sample centres · no SMS or online payments" : "Production mode"}\nPress Ctrl+C to stop.\n`,
    ),
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  console.error(`Gleam could not start: ${error.message}`);
  process.exitCode = 1;
}
