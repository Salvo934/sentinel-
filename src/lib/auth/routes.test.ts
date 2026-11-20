import { describe, expect, it } from "vitest";

import { isGuestOnlyPath, isProtectedPath, safeRedirectPath } from "./routes";

describe("safeRedirectPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/investigations/123?tab=tasks", "/investigations/123?tab=tasks"],
    ["/reports#latest", "/reports#latest"],
    ["/a/../dashboard", "/dashboard"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    ["https://evil.example/phish"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["\\\\evil.example"],
    ["javascript:alert(1)"],
    ["dashboard"],
    ["/dash\nboard"],
    ["/\t/evil.example"],
    [""],
    [undefined],
    [null],
    [42],
    [["/dashboard"]],
    [`/${"a".repeat(3000)}`],
  ])("rejects %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/dashboard");
  });

  it("uses the provided fallback", () => {
    expect(safeRedirectPath("//evil.example", "/update-password")).toBe("/update-password");
  });
});

describe("route classification", () => {
  it("protects app areas and their sub-paths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/investigations/abc")).toBe(true);
    expect(isProtectedPath("/update-password")).toBe(true);
    expect(isProtectedPath("/evidence/abc")).toBe(true);
    expect(isProtectedPath("/training/osint-corporate-investigation")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
  });

  it("does not match look-alike prefixes or public pages", () => {
    expect(isProtectedPath("/dashboard-public")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/auth/confirm")).toBe(false);
  });

  it("identifies guest-only pages", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/signup")).toBe(true);
    expect(isGuestOnlyPath("/forgot-password")).toBe(true);
    expect(isGuestOnlyPath("/update-password")).toBe(false);
  });
});
