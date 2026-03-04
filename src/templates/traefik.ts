import { ServerName, type ServerTemplate } from "./template.js";

const traefikTemplate: ServerTemplate = {
  name: ServerName.Traefik,

  headers: Object.freeze({
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  }),

  render(): string {
    return "404 page not found\n";
  },
};

export { traefikTemplate };
