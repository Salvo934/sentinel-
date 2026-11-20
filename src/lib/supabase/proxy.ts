import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_AUTHENTICATED_PATH, LOGIN_PATH, isGuestOnlyPath, isProtectedPath } from "@/lib/auth/routes";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie and performs *optimistic* redirects.
 *
 * This is not an authorization boundary: protected layouts call
 * `requireUser()` and the database enforces RLS. The proxy only avoids
 * rendering protected pages for visitors that clearly have no session.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    // Fresh checkout without .env.local: public pages stay viewable,
    // protected ones are treated as "not signed in".
    if (isProtectedPath(request.nextUrl.pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = LOGIN_PATH;
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next({ request });
  }

  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control headers that stop CDNs from caching responses
        // carrying refreshed auth cookies.
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it would make
  // session refresh bugs very hard to debug. getClaims() validates the JWT
  // signature (locally with asymmetric keys, otherwise via the Auth server).
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = typeof data?.claims?.sub === "string";

  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectPreservingCookies(loginUrl, response);
  }

  if (isAuthenticated && isGuestOnlyPath(pathname)) {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = DEFAULT_AUTHENTICATED_PATH;
    appUrl.search = "";
    return redirectPreservingCookies(appUrl, response);
  }

  return response;
}

/** A redirect must carry any refreshed session cookies, or the user is logged out. */
function redirectPreservingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}
