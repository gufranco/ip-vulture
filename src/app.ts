import fastify from "fastify";
import { createLocateRoute } from "./routes/locate.js";
import type { ServerTemplate } from "./templates/template.js";

function buildApp(template: ServerTemplate) {
  const app = fastify({
    logger: false,
    trustProxy: true,
  });

  app.register(createLocateRoute(template));

  return app;
}

export { buildApp };
