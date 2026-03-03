import type { FastifyInstance } from "fastify";

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

function buildApache404(path: string) {
  return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
<p>The requested URL ${path} was not found on this server.</p>
<hr>
<address>Apache/2.4.41 (Ubuntu) Server at localhost Port 80</address>
</body></html>
`;
}

function sendApache404(reply: import("fastify").FastifyReply, path: string) {
  return reply
    .status(404)
    .header("Content-Type", "text/html; charset=iso-8859-1")
    .header("Server", "Apache/2.4.41 (Ubuntu)")
    .send(buildApache404(path));
}

export default async function locateRoute(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    return sendApache404(reply, request.url);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const ip = request.ip;

    request.log.info({ id, ip, ips: request.ips }, "incoming request");

    let response: Response;

    try {
      response = await fetch(`http://ip-api.com/json/${ip}`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      request.log.error({ error }, "ip-api.com request failed");
      return reply.status(502).send({ error: "geolocation lookup failed" });
    }

    if (!response.ok) {
      request.log.error(
        { status: response.status },
        "ip-api.com returned error status",
      );
      return reply.status(502).send({ error: "geolocation lookup failed" });
    }

    const geo: GeolocationResponse = await response.json();

    if (geo.status === "fail") {
      request.log.warn({ id, ip, reason: geo.message }, "geolocation failed");
    } else {
      request.log.info({ id, ip, geo }, "geolocation resolved");
    }

    return sendApache404(reply, request.url);
  });
}
