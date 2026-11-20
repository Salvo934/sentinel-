import { describe, expect, it } from "vitest";

import { emailOtpTypeSchema, loginSchema, signUpSchema, updatePasswordSchema } from "./schemas";

const validSignUp = {
  fullName: "Mario Rossi",
  email: "  Mario.Rossi@Example.COM ",
  password: "Sicura2026xx",
  confirmPassword: "Sicura2026xx",
};

describe("signUpSchema", () => {
  it("accepts valid input and normalises the email", () => {
    const result = signUpSchema.parse(validSignUp);
    expect(result.email).toBe("mario.rossi@example.com");
    expect(result.fullName).toBe("Mario Rossi");
  });

  it.each([
    ["too short", "Ab1defgh"],
    ["no uppercase", "sicura2026xx"],
    ["no lowercase", "SICURA2026XX"],
    ["no digit", "SicuraSicura"],
    ["over 72 chars", `Aa1${"x".repeat(70)}`],
  ])("rejects a password that is %s", (_label, password) => {
    const result = signUpSchema.safeParse({ ...validSignUp, password, confirmPassword: password });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirmation on the confirmPassword field", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, confirmPassword: "Different2026x" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("rejects invalid email", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, email: "not-an-email" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.it", password: "x" }).success).toBe(true);
  });
});

describe("updatePasswordSchema", () => {
  it("applies the password policy", () => {
    expect(updatePasswordSchema.safeParse({ password: "weak", confirmPassword: "weak" }).success).toBe(false);
    expect(
      updatePasswordSchema.safeParse({ password: "Sicura2026xx", confirmPassword: "Sicura2026xx" }).success,
    ).toBe(true);
  });
});

describe("emailOtpTypeSchema", () => {
  it("only accepts Supabase email OTP types", () => {
    expect(emailOtpTypeSchema.safeParse("recovery").success).toBe(true);
    expect(emailOtpTypeSchema.safeParse("sms").success).toBe(false);
    expect(emailOtpTypeSchema.safeParse(null).success).toBe(false);
  });
});
