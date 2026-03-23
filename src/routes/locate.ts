import type { FastifyInstance, FastifyReply } from "fastify";
import type { ServerTemplate } from "../templates/template.js";

interface GeolocationSuccess {
  status: "success";
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

interface GeolocationFailure {
  status: "fail";
  message: string;
  query: string;
}

type GeolocationResponse = GeolocationSuccess | GeolocationFailure;

function createLocateRoute(template: ServerTemplate) {
  function sendNotFound(reply: FastifyReply, path: string) {
    reply.status(404);
    for (const [key, value] of Object.entries(template.headers)) {
      reply.header(key, value);
    }
    return reply.send(template.render(path));
  }

  return async function locateRoute(app: FastifyInstance): Promise<void> {
    app.get("/", async (request, reply) => {
      return sendNotFound(reply, request.url);
    });

    app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
      const { id } = request.params;
      const ip = request.ip;

      request.log.info({ id, ip, ips: request.ips }, "incoming request");

      try {
        const response = await fetch(`http://ip-api.com/json/${ip}`, {
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          request.log.warn(
            { status: response.status },
            "ip-api.com returned error status",
          );
        } else {
          const geo: GeolocationResponse = await response.json();

          if (geo.status === "fail") {
            request.log.warn(
              { id, ip, reason: geo.message },
              "geolocation failed",
            );
          } else {
            request.log.info({ id, ip, geo }, "geolocation resolved");
          }
        }
      } catch (error) {
        request.log.warn({ error }, "ip-api.com request failed");
      }

      return sendNotFound(reply, request.url);
    });
  };
}

export { createLocateRoute };
