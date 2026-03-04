import { ServerName, type ServerTemplate } from "./template.js";

const haproxyTemplate: ServerTemplate = {
  name: ServerName.HAProxy,

  headers: Object.freeze({
    "Content-Type": "text/html",
    "Cache-Control": "no-cache",
  }),

  render(): string {
    return `<html><body><h1>404 Not Found</h1>
No server is available to handle this request.
</body></html>
`;
  },
};

export { haproxyTemplate };
