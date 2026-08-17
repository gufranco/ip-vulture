import { escapeHtml } from "../escape.js";
import {
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";

const apacheDetails: ReadonlyMap<number, string> = new Map([
  [400, "Your browser sent a request that this server could not understand."],
  [
    401,
    "This server could not verify that you are authorized to access the document requested.",
  ],
  [403, "You don't have permission to access this resource."],
  [410, "The requested resource is no longer available on this server."],
  [
    500,
    "The server encountered an internal error or misconfiguration and was unable to complete your request.",
  ],
  [
    502,
    "The proxy server received an invalid response from an upstream server.",
  ],
  [
    503,
    "The server is temporarily unable to service your request due to maintenance downtime or capacity problems.",
  ],
  [
    504,
    "The gateway did not receive a timely response from the upstream server.",
  ],
]);

function apacheBody(context: RenderContext, signature: string): string {
  const title = statusText(context.statusCode);

  const detail =
    context.statusCode === 404
      ? `The requested URL ${escapeHtml(context.path)} was not found on this server.`
      : (apacheDetails.get(context.statusCode) ??
        "The server encountered an error.");

  return `<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>${context.statusCode} ${title}</title>
</head><body>
<h1>${title}</h1>
<p>${detail}</p>
<hr>
<address>${signature} Server at ${escapeHtml(context.host)} Port 80</address>
</body></html>
`;
}

const apache24: Simulation = {
  id: "apache",
  displayName: "Apache 2.4.62 (Ubuntu)",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html; charset=iso-8859-1",
      Server: "Apache/2.4.62 (Ubuntu)",
    });
  },

  render(context: RenderContext): string {
    return apacheBody(context, "Apache/2.4.62 (Ubuntu)");
  },
};

function nginxBody(context: RenderContext, signature: string): string {
  const title = `${context.statusCode} ${statusText(context.statusCode)}`;

  return `<html>
<head><title>${title}</title></head>
<body>
<center><h1>${title}</h1></center>
<hr><center>${signature}</center>
</body>
</html>
`;
}

const nginx1: Simulation = {
  id: "nginx",
  displayName: "nginx 1.27.4",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "nginx/1.27.4",
    });
  },

  render(context: RenderContext): string {
    return nginxBody(context, "nginx/1.27.4");
  },
};

const openresty: Simulation = {
  id: "openresty",
  displayName: "OpenResty 1.27.1.1",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "openresty/1.27.1.1",
    });
  },

  render(context: RenderContext): string {
    return nginxBody(context, "openresty/1.27.1.1");
  },
};

const iisDescriptions: ReadonlyMap<number, string> = new Map([
  [400, "The request could not be understood by the server."],
  [401, "You do not have permission to view this directory or page."],
  [403, "You do not have permission to view this directory or page."],
  [404, "File or directory not found."],
  [410, "The requested resource is no longer available."],
  [500, "There is a problem with the resource you are looking for."],
  [502, "The server received an invalid response from an upstream server."],
  [503, "The service is unavailable."],
  [504, "The gateway did not respond in time."],
]);

const iis10: Simulation = {
  id: "iis",
  displayName: "Microsoft IIS 10.0",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "Microsoft-IIS/10.0",
      "X-Powered-By": "ASP.NET",
    });
  },

  render(context: RenderContext): string {
    const summary =
      iisDescriptions.get(context.statusCode) ?? statusText(context.statusCode);

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"/>
<title>${context.statusCode} - ${summary}</title>
</head>
<body>
<h2>${context.statusCode} - ${summary}</h2>
<h3>The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</h3>
</body>
</html>
`;
  },
};

const tomcat10: Simulation = {
  id: "tomcat",
  displayName: "Apache Tomcat 10.1.34",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html;charset=utf-8",
    });
  },

  render(context: RenderContext): string {
    const title = `HTTP Status ${context.statusCode} – ${statusText(context.statusCode)}`;

    return `<!doctype html><html lang="en"><head><title>${title}</title><style type="text/css">body {font-family:Tahoma,Arial,sans-serif;} h1, h2, h3, b {color:white;background-color:#525D76;} h1 {font-size:22px;} h2 {font-size:16px;} h3 {font-size:14px;} p {font-size:12px;} a {color:black;} .line {height:1px;background-color:#525D76;border:none;}</style></head><body><h1>${title}</h1><hr class="line" /><p><b>Type</b> Status Report</p><p><b>Message</b> ${escapeHtml(context.path)}</p><p><b>Description</b> The origin server did not find a current representation for the target resource or is not willing to disclose that one exists.</p><hr class="line" /><h3>Apache Tomcat/10.1.34</h3></body></html>`;
  },
};

const lighttpd: Simulation = {
  id: "lighttpd",
  displayName: "lighttpd 1.4.76",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "lighttpd/1.4.76",
    });
  },

  render(context: RenderContext): string {
    const title = `${context.statusCode} ${statusText(context.statusCode)}`;

    return `<?xml version="1.0" encoding="iso-8859-1"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
         "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
 <head>
  <title>${title}</title>
 </head>
 <body>
  <h1>${title}</h1>
 </body>
</html>
`;
  },
};

const litespeed: Simulation = {
  id: "litespeed",
  displayName: "LiteSpeed",
  era: Era.Tens,
  genre: Genre.Vendor,
  statusCodes: SUPPORTED_STATUS_CODES,

  headers(): Readonly<Record<string, string>> {
    return Object.freeze({
      "Content-Type": "text/html",
      Server: "LiteSpeed",
    });
  },

  render(context: RenderContext): string {
    return `<!DOCTYPE html>
<html style="height:100%">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>${context.statusCode} ${statusText(context.statusCode)}</title>
</head>
<body style="color: #444; margin:0;font: normal 14px/20px Arial, Helvetica, sans-serif; height:100%; background-color: #fff;">
<div style="height:auto; min-height:100%; ">
<div style="text-align: center; width:800px; margin-left: -400px; position:absolute; top: 30%; left:50%;">
<h1 style="margin:0; font-size:150px; line-height:150px; font-weight:bold;">${context.statusCode}</h1>
<h2 style="margin-top:20px;font-size: 30px;">${statusText(context.statusCode)}</h2>
<p>The resource requested could not be found on this server!</p>
</div>
</div>
</body>
</html>
`;
  },
};

const tensSimulations: readonly Simulation[] = Object.freeze([
  apache24,
  nginx1,
  openresty,
  iis10,
  tomcat10,
  lighttpd,
  litespeed,
]);

export {
  apache24,
  iis10,
  lighttpd,
  litespeed,
  nginx1,
  openresty,
  tensSimulations,
  tomcat10,
};
