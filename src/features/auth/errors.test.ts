import { describe, expect, it } from "vitest";

import { GENERIC_AUTH_ERROR, mapAuthError } from "./errors";

describe("mapAuthError", () => {
  it("maps known Supabase error codes", () => {
    expect(mapAuthError({ code: "invalid_credentials", status: 400 })).toBe("Email o password non corretti.");
    expect(mapAuthError({ code: "email_not_confirmed" })).toMatch(/confermare/);
  });

  it("maps HTTP 429 without a code to the rate-limit message", () => {
    expect(mapAuthError({ status: 429 })).toMatch(/Troppi tentativi/);
  });

  it("never leaks raw server messages", () => {
    expect(mapAuthError({ code: "unexpected_failure", message: "duplicate key value violates..." })).toBe(
      GENERIC_AUTH_ERROR,
    );
    expect(mapAuthError(null)).toBe(GENERIC_AUTH_ERROR);
  });
});
