import { NextResponse, type NextRequest } from "next/server";

import { isUuid } from "@/lib/actions";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** 60-second signed URL for an archived report PDF (RLS-checked, forced download). */
export async function GET(request: NextRequest, ctx: RouteContext<"/reports/[id]/download">) {
  const { id } = await ctx.params;
  if (!(await getUser())) return NextResponse.redirect(new URL("/login", request.url));
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: r } = await supabase.from("reports").select("storage_path, title, version").eq("id", id).maybeSingle();
  if (!r?.storage_path) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from("investigation-reports").createSignedUrl(r.storage_path, 60, { download: true });
  if (error || !data) return new NextResponse("Not available", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
