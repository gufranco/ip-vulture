enum ServerName {
  Apache = "apache",
  Nginx = "nginx",
  IIS = "iis",
  Caddy = "caddy",
  Lighttpd = "lighttpd",
  LiteSpeed = "litespeed",
  Tomcat = "tomcat",
  OpenResty = "openresty",
  Traefik = "traefik",
  HAProxy = "haproxy",
}

interface ServerTemplate {
  readonly name: ServerName;
  readonly headers: Readonly<Record<string, string>>;
  render(path: string): string;
}

export { ServerName, type ServerTemplate };
