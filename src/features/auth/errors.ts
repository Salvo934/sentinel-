/**
 * Maps Supabase Auth errors to user-facing Italian messages.
 * Messages are deliberately generic where detail would enable account
 * enumeration (e.g. "invalid credentials" never says which field was wrong).
 */
type AuthErrorLike = { code?: string | null; status?: number | null; message?: string } | null | undefined;

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o password non corretti.",
  email_not_confirmed:
    "Devi confermare l'indirizzo email prima di accedere. Controlla la tua casella di posta.",
  user_banned: "Questo account è stato sospeso. Contatta l'amministratore.",
  weak_password: "La password non rispetta i requisiti di sicurezza.",
  same_password: "La nuova password deve essere diversa da quella attuale.",
  over_request_rate_limit: "Troppi tentativi. Attendi qualche minuto e riprova.",
  over_email_send_rate_limit: "Troppe email inviate. Attendi qualche minuto e riprova.",
  signup_disabled: "Le nuove registrazioni sono temporaneamente disabilitate.",
  session_not_found: "La sessione è scaduta. Accedi di nuovo.",
  reauthentication_needed: "Per motivi di sicurezza accedi di nuovo prima di cambiare la password.",
};

export const GENERIC_AUTH_ERROR = "Si è verificato un errore imprevisto. Riprova tra poco.";

export function mapAuthError(error: AuthErrorLike): string {
  if (!error) return GENERIC_AUTH_ERROR;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  if (error.status === 429) return MESSAGES.over_request_rate_limit!;
  return GENERIC_AUTH_ERROR;
}
