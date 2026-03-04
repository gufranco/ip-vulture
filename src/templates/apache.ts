import { ServerName, type ServerTemplate } from "./template.js";

const apacheTemplate: ServerTemplate = {
  name: ServerName.Apache,

  headers: Object.freeze({
    "Content-Type": "text/html; charset=iso-8859-1",
    Server: "Apache/2.4.62 (Ubuntu)",
  }),

  render(path: string): string {
    return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>404 Not Found</title>
</head><body>
<h1>Not Found</h1>
<p>The requested URL ${path} was not found on this server.</p>
<hr>
<address>Apache/2.4.62 (Ubuntu) Server at localhost Port 80</address>
</body></html>
`;
  },
};

export { apacheTemplate };
