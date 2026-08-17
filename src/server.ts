import { bootstrap } from "./bootstrap.js";
import { ConfigError } from "./config/config.js";

const FORCED_EXIT_MS = 10_000;

async function main(): Promise<void> {
  const started = await bootstrap();
  const { app, config } = started;

  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode: number): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.log.info({ reason }, "shutting down");

    const forced = setTimeout(() => {
      app.log.warn({ reason }, "shutdown timed out, exiting immediately");
      process.exit(exitCode === 0 ? 1 : exitCode);
    }, FORCED_EXIT_MS);

    forced.unref();

    try {
      started.stop();
      await app.close();
      clearTimeout(forced);
      process.exit(exitCode);
    } catch (error) {
      app.log.error({ err: error }, "shutdown failed");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT", 0));
  process.on("SIGTERM", () => void shutdown("SIGTERM", 0));

  process.on("unhandledRejection", (reason) => {
    app.log.error({ err: reason }, "unhandled rejection");
    void shutdown("unhandledRejection", 1);
  });

  process.on("uncaughtException", (error) => {
    app.log.error({ err: error }, "uncaught exception");
    void shutdown("uncaughtException", 1);
  });

  await app.listen({ port: config.port, host: config.host });
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(78);
  }

  process.stderr.write(
    `Failed to start: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
