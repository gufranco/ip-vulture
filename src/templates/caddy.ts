import { ServerName, type ServerTemplate } from "./template.js";

const caddyTemplate: ServerTemplate = {
  name: ServerName.Caddy,

  headers: Object.freeze({
    Server: "Caddy",
  }),

  render(): string {
    return "";
  },
};

export { caddyTemplate };
