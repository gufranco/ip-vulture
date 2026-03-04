import { buildApp } from "./app.js";
import { resolveTemplate } from "./templates/registry.js";

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";
const serverTemplate = process.env.SERVER_TEMPLATE || "apache";

const template = resolveTemplate(serverTemplate);
const app = buildApp(template);
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
