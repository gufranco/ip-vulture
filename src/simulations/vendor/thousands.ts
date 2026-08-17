import { escapeHtml } from "../escape.js";
import {
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";

const apache20: Simulation = {
  id: "apache-2.0",
  displayName: "Apache 2.0.63 (Unix)",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/2.0.63 (Unix) PHP/4.4.9",
    });
  },

  render(context: RenderContext): string {
    const detail =
      context.statusCode === 404
        ? `The requested URL ${escapeHtml(context.path)} was not found on this server.`
        : "The server encountered an internal error or misconfiguration and was unable to complete your request.";

    return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>${context.statusCode} ${statusText(context.statusCode)}</title>
</head><body>
<h1>${statusText(context.statusCode)}</h1>
<p>${detail}</p>
<hr />
<address>Apache/2.0.63 (Unix) PHP/4.4.9 Server at ${escapeHtml(context.host)} Port 80</address>
</body></html>
`;
  },
};

const iis6: Simulation = {
  id: "iis-6",
  displayName: "Microsoft IIS 6.0",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Microsoft-IIS/6.0",
      "X-Powered-By": "ASP.NET",
      "X-AspNet-Version": "2.0.50727",
    });
  },

  render(context: RenderContext): string {
    return `<html><head><title>The page cannot be found</title>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">
<style>a:link {font:8pt/11pt verdana; color:FF0000} a:visited {font:8pt/11pt verdana; color:#4e4e4e}</style>
</head>
<body bgcolor="white">
<table width="500" border="0" cellspacing="10"><tr><td>
<h1 style="COLOR:000000; FONT: 13pt/15pt verdana">The page cannot be found</h1>
<p style="COLOR:000000; FONT: 8pt/11pt verdana">The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
<hr color="#C0C0C0" noshade>
<p style="COLOR:000000; FONT: 8pt/11pt verdana">HTTP Error ${context.statusCode} - ${statusText(context.statusCode)}<br>Internet Information Services (IIS)</p>
</td></tr></table>
</body></html>
`;
  },
};

const nginx07: Simulation = {
  id: "nginx-0.7",
  displayName: "nginx 0.7.65",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "nginx/0.7.65",
    });
  },

  render(context: RenderContext): string {
    const title = `${context.statusCode} ${statusText(context.statusCode)}`;

    return `<html>
<head><title>${title}</title></head>
<body bgcolor="white">
<center><h1>${title}</h1></center>
<hr><center>nginx/0.7.65</center>
</body>
</html>
`;
  },
};

const zeus: Simulation = {
  id: "zeus",
  displayName: "Zeus 4.3",
  era: Era.Thousands,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Zeus/4.3",
    });
  },

  render(context: RenderContext): string {
    return `<html><head><title>${statusText(context.statusCode)}</title></head>
<body>
<h1>${statusText(context.statusCode)}</h1>
<p>The requested document was not found on this server.</p>
<hr>
<address>Zeus Web Server</address>
</body></html>
`;
  },
};

const thousandsSimulations: readonly Simulation[] = Object.freeze([
  apache20,
  iis6,
  nginx07,
  zeus,
]);

export { apache20, iis6, nginx07, thousandsSimulations, zeus };
