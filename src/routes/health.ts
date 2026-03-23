import type { FastifyInstance } from "fastify";

async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    { config: { rateLimit: false } },
    async (_request, reply) => {
      return reply.status(200).send({ status: "ok" });
    },
  );
}

export { healthRoute };
