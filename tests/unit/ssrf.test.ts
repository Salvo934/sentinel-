import { describe, expect, it } from "vitest";

import { isAllowedOutboundUrl, isBlockedAddress } from "@/lib/net/ssrf";

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows public %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));

  it("only allows https to allow-listed hosts", () => {
    expect(isAllowedOutboundUrl("https://rdap.org/domain/example.com")).toBe(true);
    expect(isAllowedOutboundUrl("http://rdap.org/domain/example.com")).toBe(false);
    expect(isAllowedOutboundUrl("https://evil.example/")).toBe(false);
    expect(isAllowedOutboundUrl("https://user:pw@rdap.org/")).toBe(false);
    expect(isAllowedOutboundUrl("https://rdap.org:8443/")).toBe(false);
    expect(isAllowedOutboundUrl("https://rdap.org.evil.example/")).toBe(false);
  });
});
