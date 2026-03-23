import rateLimit from "@fastify/rate-limit";
import fastify from "fastify";
import { healthRoute } from "./routes/health.js";
import { createLocateRoute } from "./routes/locate.js";
import type { ServerTemplate } from "./templates/template.js";

interface AppOptions {
  readonly template: ServerTemplate;
  readonly logger?: boolean;
}

function buildApp({ template, logger = false }: AppOptions) {
  const app = fastify({
    logger,
    trustProxy: true,
  });

  app.register(rateLimit, {
    max: 40,
    timeWindow: 60_000,
  });

  app.register(healthRoute);
  app.register(createLocateRoute(template));

  return app;
}

export { type AppOptions, buildApp };
