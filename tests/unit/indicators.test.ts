import { describe, expect, it } from "vitest";

import { defang, detectIndicatorType, isDocumentationIndicator, isIPv6, normalizeIndicator, refang, validateIndicator } from "@/lib/indicators";

describe("IOC validation", () => {
  it.each([
    ["ipv4", "203.0.113.45", true],
    ["ipv4", "256.1.1.1", false],
    ["ipv4", "01.2.3.4", false],
    ["ipv6", "2001:db8:85a3::8a2e:370:7334", true],
    ["ipv6", "::ffff:192.0.2.1", true],
    ["ipv6", "2001:db8::1::2", false],
    ["domain", "evil.example", true],
    ["domain", "EVIL.Example.", true],
    ["domain", "-bad.example", false],
    ["domain", "nodot", false],
    ["url", "https://login.example/path?q=1", true],
    ["url", "javascript:alert(1)", false],
    ["url", "hxxps://evil[.]example/x", true],
    ["sha256", "a".repeat(64), true],
    ["sha1", "b".repeat(40), true],
    ["md5", "c".repeat(32), true],
    ["md5", "z".repeat(32), false],
  ] as const)("%s %s → %s", (type, value, expected) => {
    expect(validateIndicator(type, value)).toBe(expected);
  });

  it("detects types", () => {
    expect(detectIndicatorType("198.51.100.23")).toBe("ipv4");
    expect(detectIndicatorType("2001:db8::10")).toBe("ipv6");
    expect(detectIndicatorType("hxxp://bad[.]example/a")).toBe("url");
    expect(detectIndicatorType("d".repeat(64))).toBe("sha256");
    expect(detectIndicatorType("fatture-online-verifica.example")).toBe("domain");
    expect(detectIndicatorType("not an ioc")).toBeNull();
  });

  it("normalizes and (de)fangs", () => {
    expect(normalizeIndicator("domain", "Evil[.]Example.")).toBe("evil.example");
    expect(refang("hxxps://a[.]b(.)example")).toBe("https://a.b.example");
    expect(defang("https://login.evil.example/x")).toBe("hxxps://login.evil.example/x".replace(/\.(?=[^.]*$)/, "[.]"));
    expect(defang("evil.example")).toBe("evil[.]example");
  });

  it("recognises documentation ranges", () => {
    expect(isDocumentationIndicator("ipv4", "192.0.2.4")).toBe(true);
    expect(isDocumentationIndicator("ipv4", "8.8.8.8")).toBe(false);
    expect(isDocumentationIndicator("domain", "x.example")).toBe(true);
    expect(isDocumentationIndicator("url", "https://a.test/x")).toBe(true);
    expect(isIPv6("2001:db8::1")).toBe(true);
  });
});
