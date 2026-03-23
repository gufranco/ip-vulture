import { resolveTemplate } from "./templates/registry.js";
import type { ServerTemplate } from "./templates/template.js";

interface Config {
  readonly port: number;
  readonly host: string;
  readonly template: ServerTemplate;
}

function loadConfig(): Config {
  const rawPort = process.env.PORT ?? "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT: "${rawPort}". Must be an integer between 1 and 65535.`,
    );
  }

  const host = process.env.HOST ?? "0.0.0.0";

  if (host.length === 0) {
    throw new Error("Invalid HOST: must be a non-empty string.");
  }

  const templateName = process.env.SERVER_TEMPLATE ?? "apache";
  const template = resolveTemplate(templateName);

  return { port, host, template };
}

export { type Config, loadConfig };
