import { buildApp } from "./app.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const app = buildApp();
app.log.level = "info";

const shutdown = async () => {
  app.log.info("shutting down");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen({ port, host }, (error) => {
  if (error) {
    app.log.error(error);
    process.exit(1);
  }
});
