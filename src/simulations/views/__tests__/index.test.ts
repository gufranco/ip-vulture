import { describe, expect, it } from "vitest";
import { listViews, loadView, renderView } from "../index.js";

describe("renderView substitution", () => {
  it("should replace a named placeholder", () => {
    expect(renderView("<h1>{{title}}</h1>", { title: "Not Found" })).toBe(
      "<h1>Not Found</h1>",
    );
  });

  it("should replace every occurrence of the same placeholder", () => {
    expect(renderView("{{a}}-{{a}}", { a: "x" })).toBe("x-x");
  });

  it("should tolerate whitespace inside the delimiters", () => {
    expect(renderView("{{ title }}", { title: "ok" })).toBe("ok");
  });

  it("should leave an unknown placeholder empty rather than printing it", () => {
    expect(renderView("[{{missing}}]", {})).toBe("[]");
  });

  it("should preserve surrounding bytes exactly", () => {
    const template = "<html>\n  <body>{{x}}</body>\n</html>\n";

    expect(renderView(template, { x: "1" })).toBe(
      "<html>\n  <body>1</body>\n</html>\n",
    );
  });
});

describe("renderView escaping", () => {
  it("should escape a value by default", () => {
    expect(renderView("{{path}}", { path: "/<script>alert(1)</script>" })).toBe(
      "/&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("should escape quotes so a value cannot break out of an attribute", () => {
    expect(renderView('href="{{u}}"', { u: '"onmouseover="x' })).toBe(
      'href="&quot;onmouseover=&quot;x"',
    );
  });

  it("should escape ampersands", () => {
    expect(renderView("{{q}}", { q: "a&b" })).toBe("a&amp;b");
  });

  it("should not escape a triple-brace placeholder", () => {
    expect(renderView("{{{markup}}}", { markup: "<hr>" })).toBe("<hr>");
  });

  it("should keep escaping the double-brace form when both appear", () => {
    const result = renderView("{{{raw}}}|{{safe}}", {
      raw: "<b>",
      safe: "<b>",
    });

    expect(result).toBe("<b>|&lt;b&gt;");
  });
});

describe("loadView", () => {
  it("should load a known view", () => {
    expect(loadView("apache").length).toBeGreaterThan(0);
  });

  it("should throw a named error for an unknown view", () => {
    expect(() => loadView("does-not-exist")).toThrow(/does-not-exist/);
  });

  it("should return the same content on repeated calls", () => {
    expect(loadView("apache")).toBe(loadView("apache"));
  });
});

describe("view inventory", () => {
  it("should expose every view file on disk", () => {
    expect(listViews().length).toBeGreaterThan(0);
  });

  it("should contain no unresolved placeholder syntax errors", () => {
    for (const name of listViews()) {
      const content = loadView(name);
      const opens = (content.match(/\{\{/g) ?? []).length;
      const closes = (content.match(/\}\}/g) ?? []).length;

      expect(opens).toBe(closes);
    }
  });

  it("should hold no TypeScript template interpolation", () => {
    for (const name of listViews()) {
      expect(loadView(name)).not.toMatch(/\$\{/);
    }
  });
});
