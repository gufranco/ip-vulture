import fastify from "fastify";
import locateRoute from "./routes/locate.js";

export function buildApp() {
  const app = fastify({
    logger: false,
    trustProxy: true,
  });

  app.register(locateRoute);

  return app;
}
