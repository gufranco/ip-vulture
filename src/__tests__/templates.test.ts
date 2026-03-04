import { describe, expect, it } from "vitest";
import { apacheTemplate } from "../templates/apache.js";
import { caddyTemplate } from "../templates/caddy.js";
import { haproxyTemplate } from "../templates/haproxy.js";
import { iisTemplate } from "../templates/iis.js";
import { lighttpdTemplate } from "../templates/lighttpd.js";
import { litespeedTemplate } from "../templates/litespeed.js";
import { nginxTemplate } from "../templates/nginx.js";
import { openrestyTemplate } from "../templates/openresty.js";
import { templates } from "../templates/registry.js";
import { ServerName } from "../templates/template.js";
import { tomcatTemplate } from "../templates/tomcat.js";
import { traefikTemplate } from "../templates/traefik.js";

describe("ServerTemplate contract", () => {
  const allTemplates = [...templates.values()];

  it("should have a template for every ServerName value", () => {
    // Arrange
    const enumValues = Object.values(ServerName);

    // Act
    const registeredNames = allTemplates.map((t) => t.name);

    // Assert
    expect(registeredNames).toHaveLength(enumValues.length);
    for (const value of enumValues) {
      expect(registeredNames).toContain(value);
    }
  });

  it.each(allTemplates)("$name should have frozen headers", (template) => {
    // Arrange
    // Act
    // Assert
    expect(Object.isFrozen(template.headers)).toBe(true);
  });

  it.each(allTemplates)("$name render should return a string", (template) => {
    // Arrange
    // Act
    const body = template.render("/test-path");

    // Assert
    expect(typeof body).toBe("string");
  });
});

describe("Apache template", () => {
  it("should include the requested path in the body", () => {
    // Arrange
    // Act
    const body = apacheTemplate.render("/some/page");

    // Assert
    expect(body).toContain("The requested URL /some/page was not found");
  });

  it("should set Content-Type and Server headers", () => {
    // Arrange
    // Act
    // Assert
    expect(apacheTemplate.headers["Content-Type"]).toBe(
      "text/html; charset=iso-8859-1",
    );
    expect(apacheTemplate.headers.Server).toBe("Apache/2.4.62 (Ubuntu)");
  });
});

describe("Nginx template", () => {
  it("should not include the path in the body", () => {
    // Arrange
    // Act
    const body = nginxTemplate.render("/secret");

    // Assert
    expect(body).not.toContain("/secret");
  });

  it("should include the server version", () => {
    // Arrange
    // Act
    // Assert
    expect(nginxTemplate.headers.Server).toBe("nginx/1.27.4");
    expect(nginxTemplate.render("/")).toContain("nginx/1.27.4");
  });
});

describe("IIS template", () => {
  it("should include X-Powered-By header", () => {
    // Arrange
    // Act
    // Assert
    expect(iisTemplate.headers["X-Powered-By"]).toBe("ASP.NET");
  });

  it("should set the Server header", () => {
    // Arrange
    // Act
    // Assert
    expect(iisTemplate.headers.Server).toBe("Microsoft-IIS/10.0");
  });
});

describe("Caddy template", () => {
  it("should return an empty body", () => {
    // Arrange
    // Act
    const body = caddyTemplate.render("/anything");

    // Assert
    expect(body).toBe("");
  });

  it("should not set Content-Type header", () => {
    // Arrange
    // Act
    // Assert
    expect(caddyTemplate.headers["Content-Type"]).toBeUndefined();
  });
});

describe("Lighttpd template", () => {
  it("should set the Server header", () => {
    // Arrange
    // Act
    // Assert
    expect(lighttpdTemplate.headers.Server).toBe("lighttpd/1.4.76");
  });
});

describe("LiteSpeed template", () => {
  it("should set the Server header", () => {
    // Arrange
    // Act
    // Assert
    expect(litespeedTemplate.headers.Server).toBe("LiteSpeed");
  });
});

describe("Tomcat template", () => {
  it("should include the path in the body", () => {
    // Arrange
    // Act
    const body = tomcatTemplate.render("/admin");

    // Assert
    expect(body).toContain("/admin");
  });

  it("should escape HTML in the path", () => {
    // Arrange
    // Act
    const body = tomcatTemplate.render("/<script>alert(1)</script>");

    // Assert
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;");
  });

  it("should not set a Server header", () => {
    // Arrange
    // Act
    // Assert
    expect(tomcatTemplate.headers.Server).toBeUndefined();
  });
});

describe("OpenResty template", () => {
  it("should set the Server header", () => {
    // Arrange
    // Act
    // Assert
    expect(openrestyTemplate.headers.Server).toBe("openresty/1.27.1.1");
  });
});

describe("Traefik template", () => {
  it("should return plain text", () => {
    // Arrange
    // Act
    // Assert
    expect(traefikTemplate.headers["Content-Type"]).toBe(
      "text/plain; charset=utf-8",
    );
  });

  it("should set X-Content-Type-Options", () => {
    // Arrange
    // Act
    // Assert
    expect(traefikTemplate.headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});

describe("HAProxy template", () => {
  it("should set Cache-Control header", () => {
    // Arrange
    // Act
    // Assert
    expect(haproxyTemplate.headers["Cache-Control"]).toBe("no-cache");
  });

  it("should not set a Server header", () => {
    // Arrange
    // Act
    // Assert
    expect(haproxyTemplate.headers.Server).toBeUndefined();
  });
});
