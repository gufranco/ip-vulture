import { escapeHtml } from "../escape.js";
import { APACHE_PROTOCOL } from "../protocol.js";
import {
  Era,
  Genre,
  type RenderContext,
  type Simulation,
  SUPPORTED_STATUS_CODES,
  statusText,
} from "../simulation.js";

const htmlHeaders: Readonly<Record<string, string>> = Object.freeze({
  "Content-Type": "text/html; charset=iso-8859-1",
  Server: "Apache/1.3.42 (Unix)",
});

function visitorCount(context: RenderContext): string {
  const seed = context.path.length * 1373 + context.statusCode * 7919;

  return String(100000 + (seed % 899999)).padStart(6, "0");
}

const constructionZone: Simulation = {
  id: "construction-zone",
  displayName: "Under Construction (2001 personal page)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return `<HTML>
<HEAD>
<TITLE>Oops! Error ${context.statusCode}</TITLE>
</HEAD>
<BODY BGCOLOR="#000080" TEXT="#FFFF00" LINK="#00FFFF" VLINK="#FF00FF">
<CENTER>
<FONT FACE="Comic Sans MS, Arial" SIZE="6"><B>THIS PAGE IS UNDER CONSTRUCTION</B></FONT>
<BR><BR>
<svg width="120" height="90" viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
  <polygon points="60,8 114,82 6,82" fill="#FFCC00" stroke="#000000" stroke-width="4"/>
  <rect x="54" y="30" width="12" height="28" fill="#000000"/>
  <rect x="54" y="64" width="12" height="10" fill="#000000"/>
</svg>
<BR><BR>
<FONT FACE="Comic Sans MS, Arial" SIZE="4">
Sorry! The page <B>${escapeHtml(context.path)}</B> is not here.<BR>
Maybe I moved it. Maybe I deleted it. Maybe it never existed!<BR>
Come back soon, I update this site EVERY WEEK!!!
</FONT>
<BR><BR>
<HR WIDTH="60%">
<FONT FACE="Courier New" SIZE="2">
Error ${context.statusCode} ${statusText(context.statusCode)}<BR>
You are visitor number <B>${visitorCount(context)}</B><BR>
Best viewed in 800x600 with a 4.0 browser
</FONT>
<BR><BR>
<FONT FACE="Arial" SIZE="2"><A HREF="/">[ Back to my homepage ]</A> | <A HREF="/guestbook.html">[ Sign my guestbook ]</A></FONT>
</CENTER>
</BODY>
</HTML>
`;
  },
};

const lostInSpace: Simulation = {
  id: "lost-in-space",
  displayName: "Lost In Space (2003 hobby site)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return `<HTML>
<HEAD><TITLE>404 - Lost in space</TITLE></HEAD>
<BODY BGCOLOR="#0B0B2B" TEXT="#DDDDFF">
<CENTER>
<BR>
<svg width="220" height="150" viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
  <circle cx="30" cy="20" r="2" fill="#FFFFFF"/>
  <circle cx="80" cy="45" r="1.5" fill="#FFFFFF"/>
  <circle cx="170" cy="25" r="2" fill="#FFFFFF"/>
  <circle cx="200" cy="90" r="1.5" fill="#FFFFFF"/>
  <circle cx="50" cy="120" r="2" fill="#FFFFFF"/>
  <ellipse cx="110" cy="80" rx="55" ry="14" fill="#8899DD"/>
  <ellipse cx="110" cy="72" rx="30" ry="22" fill="#BBCCFF"/>
  <circle cx="98" cy="70" r="4" fill="#223366"/>
  <circle cx="122" cy="70" r="4" fill="#223366"/>
</svg>
<BR>
<FONT FACE="Verdana, Arial" SIZE="5" COLOR="#FFCC33"><B>404 - LOST IN SPACE</B></FONT>
<BR><BR>
<FONT FACE="Verdana, Arial" SIZE="2">
Our sensors could not locate:<BR>
<TT>${escapeHtml(context.path)}</TT><BR><BR>
It may have drifted into a black hole, or you may have typed the coordinates wrong.<BR>
Either way, the page is gone.
</FONT>
<BR><BR>
<FONT FACE="Verdana" SIZE="1">Status ${context.statusCode} ${statusText(context.statusCode)} | Navigation systems online</FONT>
<BR><BR>
<A HREF="/"><FONT FACE="Verdana" SIZE="2" COLOR="#66CCFF">&lt;&lt; Return to base</FONT></A>
</CENTER>
</BODY>
</HTML>
`;
  },
};

const webringHub: Simulation = {
  id: "webring-hub",
  displayName: "Webring Hub (2002 fan site)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return `<HTML>
<HEAD><TITLE>Page Not Found :(</TITLE></HEAD>
<BODY BGCOLOR="#FFFFCC" TEXT="#333300">
<CENTER>
<TABLE WIDTH="640" BORDER="4" BORDERCOLOR="#CC9900" CELLPADDING="12" BGCOLOR="#FFFFFF">
<TR><TD ALIGN="CENTER">
<FONT FACE="Trebuchet MS, Arial" SIZE="5" COLOR="#996600"><B>~*~ Page Not Found ~*~</B></FONT>
<BR><BR>
<FONT FACE="Trebuchet MS, Arial" SIZE="2">
You were looking for <B>${escapeHtml(context.path)}</B><BR>
but that page has wandered off.
<BR><BR>
This happens sometimes. Try the links below!
</FONT>
<BR><BR>
<FONT FACE="Arial" SIZE="2">
<A HREF="/">Home</A> ~ <A HREF="/links.html">Links</A> ~ <A HREF="/about.html">About Me</A> ~ <A HREF="/guestbook.html">Guestbook</A>
</FONT>
<BR><BR>
<HR SIZE="1" WIDTH="80%">
<FONT FACE="Arial" SIZE="1">
This site is a proud member of the Retro Pages Webring<BR>
[ <A HREF="/ring/prev">Previous</A> | <A HREF="/ring/random">Random</A> | <A HREF="/ring/next">Next</A> ]
<BR><BR>
Error ${context.statusCode} ${statusText(context.statusCode)}
</FONT>
</TD></TR>
</TABLE>
</CENTER>
</BODY>
</HTML>
`;
  },
};

const cyberCafe: Simulation = {
  id: "cyber-cafe",
  displayName: "Cyber Cafe (2000 small business site)",
  era: Era.Thousands,
  genre: Genre.Creative,
  statusCodes: SUPPORTED_STATUS_CODES,
  protocol: APACHE_PROTOCOL,

  headers(): Readonly<Record<string, string>> {
    return htmlHeaders;
  },

  render(context: RenderContext): string {
    return `<HTML>
<HEAD><TITLE>Error ${context.statusCode}</TITLE></HEAD>
<BODY BGCOLOR="#CCCCCC" TEXT="#000000" LEFTMARGIN="0" TOPMARGIN="0">
<CENTER>
<table width="760" border="0" cellspacing="0" cellpadding="0" bgcolor="#FFFFFF">
<TR>
  <TD BGCOLOR="#003366" HEIGHT="70" ALIGN="LEFT" VALIGN="MIDDLE">
    &nbsp;&nbsp;<font face="Arial Black, Arial" size="5" color="#FFFFFF">CYBER CAFE</font>
    <font face="Arial" size="2" color="#99CCFF">&nbsp;&nbsp;internet &middot; coffee &middot; games</font>
  </TD>
</TR>
<TR>
  <TD BGCOLOR="#6699CC" HEIGHT="22" ALIGN="CENTER">
    <font face="Arial" size="2" color="#FFFFFF">
    <A HREF="/"><font color="#FFFFFF">HOME</font></A> |
    <A HREF="/precos.html"><font color="#FFFFFF">PRICES</font></A> |
    <A HREF="/contato.html"><font color="#FFFFFF">CONTACT</font></A>
    </font>
  </TD>
</TR>
<TR>
  <TD ALIGN="CENTER" VALIGN="TOP" HEIGHT="260">
    <BR>
    <font face="Arial" size="6" color="#003366"><B>${context.statusCode}</B></font><BR>
    <font face="Arial" size="4" color="#333333">${statusText(context.statusCode)}</font>
    <BR><BR>
    <font face="Arial" size="2">
    The page <B>${escapeHtml(context.path)}</B> could not be found on this server.<BR><BR>
    Our webmaster has been notified by e-mail.<BR>
    Please use the menu above, or come have a coffee while we sort it out.
    </font>
    <BR><BR>
    <TABLE BORDER="1" BORDERCOLOR="#999999" CELLPADDING="6" CELLSPACING="0" BGCOLOR="#EEEEEE">
      <TR><TD><font face="Courier New" size="1">Requested: ${escapeHtml(context.path)}<BR>Method: ${escapeHtml(context.method)}<BR>Status: ${context.statusCode}</font></TD></TR>
    </TABLE>
  </TD>
</TR>
<TR>
  <TD BGCOLOR="#003366" HEIGHT="34" ALIGN="CENTER">
    <font face="Arial" size="1" color="#99CCFF">Best viewed at 800x600 &middot; This site is optimized for 4.0 browsers</font>
  </TD>
</TR>
</table>
</CENTER>
</BODY>
</HTML>
`;
  },
};

const creativeSimulations: readonly Simulation[] = Object.freeze([
  constructionZone,
  lostInSpace,
  webringHub,
  cyberCafe,
]);

export {
  constructionZone,
  creativeSimulations,
  cyberCafe,
  lostInSpace,
  webringHub,
};
