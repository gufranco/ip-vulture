import { escapeHtml } from "../escape.js";
import {
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";

const ncsaHttpd: Simulation = {
  id: "ncsa-httpd",
  displayName: "NCSA httpd 1.5.2",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "NCSA/1.5.2",
    });
  },

  render(context: RenderContext): string {
    return `<HEAD><TITLE>${context.statusCode} ${statusText(context.statusCode)}</TITLE></HEAD>
<BODY>
<H1>${statusText(context.statusCode)}</H1>
The requested object ${escapeHtml(context.path)} was not found on this server.
The link you followed is either outdated, inaccurate, or the server has been
instructed not to let you have it.<P>
</BODY>
`;
  },
};

const cernHttpd: Simulation = {
  id: "cern-httpd",
  displayName: "CERN httpd 3.0A",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "CERN/3.0A",
    });
  },

  render(context: RenderContext): string {
    return `<HEAD><TITLE>Error ${context.statusCode}</TITLE></HEAD>
<BODY>
<H1>Error ${context.statusCode}</H1>
<P>Unable to access document ${escapeHtml(context.path)}
<P>Reason: ${statusText(context.statusCode)}
<HR>
<ADDRESS>CERN-HTTPD/3.0A</ADDRESS>
</BODY>
`;
  },
};

const apache13: Simulation = {
  id: "apache-1.3",
  displayName: "Apache 1.3.42 (Unix)",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/1.3.42 (Unix)",
    });
  },

  render(context: RenderContext): string {
    const detail =
      context.statusCode === 404
        ? `The requested URL ${escapeHtml(context.path)} was not found on this server.`
        : "The server encountered an error while processing your request.";

    return `<HTML><HEAD>
<TITLE>${context.statusCode} ${statusText(context.statusCode)}</TITLE>
</HEAD><BODY>
<H1>${statusText(context.statusCode)}</H1>
${detail}<P>
<HR>
<ADDRESS>Apache/1.3.42 Server at ${escapeHtml(context.host)} Port 80</ADDRESS>
</BODY></HTML>
`;
  },
};

const iis4: Simulation = {
  id: "iis-4",
  displayName: "Microsoft IIS 4.0",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Microsoft-IIS/4.0",
    });
  },

  render(context: RenderContext): string {
    return `<html><head><title>Error ${context.statusCode}</title></head>
<body>
<h2>HTTP ${context.statusCode} - ${statusText(context.statusCode)}</h2>
<p>The Web server cannot find the file or script you asked for. Please check the
URL to ensure that the path is correct.</p>
<hr>
<p>Please contact the server's administrator if this problem persists.</p>
<p><i>Internet Information Server</i></p>
</body></html>
`;
  },
};

const netscapeEnterprise: Simulation = {
  id: "netscape-enterprise",
  displayName: "Netscape Enterprise 3.6",
  era: Era.Nineties,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Netscape-Enterprise/3.6",
    });
  },

  render(context: RenderContext): string {
    return `<HTML><HEAD><TITLE>${statusText(context.statusCode)}</TITLE></HEAD>
<BODY>
<H1>${statusText(context.statusCode)}</H1>
The server cannot find the file ${escapeHtml(context.path)}.
<P>
<HR>
<ADDRESS>Netscape-Enterprise/3.6</ADDRESS>
</BODY></HTML>
`;
  },
};

const ninetiesSimulations: readonly Simulation[] = Object.freeze([
  ncsaHttpd,
  cernHttpd,
  apache13,
  iis4,
  netscapeEnterprise,
]);

export {
  apache13,
  cernHttpd,
  iis4,
  ncsaHttpd,
  netscapeEnterprise,
  ninetiesSimulations,
};
