import { NextResponse, type NextRequest } from "next/server";

import { emailOtpTypeSchema } from "@/features/auth/schemas";
import { safeRedirectPath } from "@/lib/auth/routes";
import { publicOrigin } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Target of the links in the confirmation / recovery emails.
 *
 * - `token_hash` + `type`: custom templates in supabase/templates/*.html
 *   (recommended — works even if the link is opened on another device).
 * - `code`: PKCE fallback when a hosted project keeps the default templates
 *   (only works in the browser that started the flow).
 *
 * On success redirects to a sanitised same-origin path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = emailOtpTypeSchema.safeParse(searchParams.get("type"));
  const fallback = type.success && type.data === "recovery" ? "/update-password" : "/dashboard";
  const next = safeRedirectPath(searchParams.get("next"), fallback);
  const code = searchParams.get("code");
  const origin = publicOrigin(request);

  if (tokenHash && tokenHash.length <= 512 && type.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  if (code && code.length <= 512) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  const errorUrl = new URL("/login", origin);
  errorUrl.searchParams.set("error", "link_invalid");
  return NextResponse.redirect(errorUrl);
}
