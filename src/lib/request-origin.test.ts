import { describe, expect, it } from "vitest";

import { publicOrigin } from "./request-origin";

const req = (url: string, headers: Record<string, string> = {}) => ({ url, headers: new Headers(headers) });

describe("publicOrigin", () => {
  it("prefers the Host header over an internal request URL", () => {
    expect(
      publicOrigin(
        req("http://localhost/auth/confirm", {
          host: "sentinel.example.workers.dev",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe("https://sentinel.example.workers.dev");
  });
  it("keeps the port of local hosts", () => {
    expect(publicOrigin(req("http://localhost:8788/x", { host: "127.0.0.1:8788" }))).toBe(
      "http://127.0.0.1:8788",
    );
  });
  it("falls back to the request URL for missing or malformed hosts", () => {
    expect(publicOrigin(req("https://app.example.com/x"))).toBe("https://app.example.com");
    expect(publicOrigin(req("https://app.example.com/x", { host: "evil.com/path" }))).toBe(
      "https://app.example.com",
    );
    expect(publicOrigin(req("https://app.example.com/x", { host: "a@b.com" }))).toBe(
      "https://app.example.com",
    );
  });
  it("ignores unexpected forwarded protocols", () => {
    expect(
      publicOrigin(
        req("https://app.example.com/x", { host: "app.example.com", "x-forwarded-proto": "javascript" }),
      ),
    ).toBe("https://app.example.com");
  });
});
