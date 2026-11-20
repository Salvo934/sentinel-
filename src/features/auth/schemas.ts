import { z } from "zod";

/**
 * Must mirror the Supabase Auth password policy in supabase/config.toml
 * (minimum_password_length = 10, password_requirements = "lower_upper_letters_digits").
 * Supabase Auth remains the authority; this gives immediate feedback.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt limit used by Supabase Auth

const email = z
  .string()
  .trim()
  .min(1, "Inserisci la tua email")
  .max(254, "Email troppo lunga")
  .pipe(z.email("Inserisci un indirizzo email valido"))
  .transform((value) => value.toLowerCase());

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Almeno ${PASSWORD_MIN_LENGTH} caratteri`)
  .max(PASSWORD_MAX_LENGTH, `Al massimo ${PASSWORD_MAX_LENGTH} caratteri`)
  .regex(/[a-z]/, "Almeno una lettera minuscola")
  .regex(/[A-Z]/, "Almeno una lettera maiuscola")
  .regex(/[0-9]/, "Almeno una cifra");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Inserisci la password").max(PASSWORD_MAX_LENGTH),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Inserisci nome e cognome").max(100, "Massimo 100 caratteri"),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Le password non coincidono",
  });

export const forgotPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Le password non coincidono",
  });

/** OTP types accepted by /auth/confirm (Supabase `EmailOtpType`). */
export const emailOtpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export type LoginInput = z.input<typeof loginSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type UpdatePasswordInput = z.input<typeof updatePasswordSchema>;
