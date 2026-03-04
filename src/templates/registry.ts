import { apacheTemplate } from "./apache.js";
import { caddyTemplate } from "./caddy.js";
import { haproxyTemplate } from "./haproxy.js";
import { iisTemplate } from "./iis.js";
import { lighttpdTemplate } from "./lighttpd.js";
import { litespeedTemplate } from "./litespeed.js";
import { nginxTemplate } from "./nginx.js";
import { openrestyTemplate } from "./openresty.js";
import { ServerName, type ServerTemplate } from "./template.js";
import { tomcatTemplate } from "./tomcat.js";
import { traefikTemplate } from "./traefik.js";

const templates: ReadonlyMap<ServerName, ServerTemplate> = new Map([
  [ServerName.Apache, apacheTemplate],
  [ServerName.Nginx, nginxTemplate],
  [ServerName.IIS, iisTemplate],
  [ServerName.Caddy, caddyTemplate],
  [ServerName.Lighttpd, lighttpdTemplate],
  [ServerName.LiteSpeed, litespeedTemplate],
  [ServerName.Tomcat, tomcatTemplate],
  [ServerName.OpenResty, openrestyTemplate],
  [ServerName.Traefik, traefikTemplate],
  [ServerName.HAProxy, haproxyTemplate],
]);

function pickRandom(): ServerTemplate {
  const all = [...templates.values()];
  const index = Math.floor(Math.random() * all.length);
  const template = all[index];
  if (!template) {
    throw new Error("No templates registered");
  }
  return template;
}

function resolveTemplate(name: string): ServerTemplate {
  if (name === "random") {
    return pickRandom();
  }

  const values = Object.values(ServerName) as string[];
  if (!values.includes(name)) {
    throw new Error(
      `Unknown server template: "${name}". Valid options: ${values.join(", ")}, random`,
    );
  }

  const template = templates.get(name as ServerName);
  if (!template) {
    throw new Error(`Template not found for: "${name}"`);
  }
  return template;
}

export { resolveTemplate, templates };
