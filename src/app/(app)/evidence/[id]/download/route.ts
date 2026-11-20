import { NextResponse, type NextRequest } from "next/server";

import { isUuid } from "@/lib/actions";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Issues a 60-second signed URL that forces a download (Content-Disposition:
 * attachment), so untrusted files are never rendered inline by the app.
 * Access is checked by RLS on both the evidence row and the storage object.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/evidence/[id]/download">) {
  const { id } = await ctx.params;
  if (!(await getUser())) return NextResponse.redirect(new URL("/login", request.url));
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: ev } = await supabase
    .from("evidence")
    .select("id, case_id, storage_path, original_filename, cases(organization_id)")
    .eq("id", id)
    .maybeSingle();
  if (!ev?.storage_path) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage
    .from("investigation-evidence")
    .createSignedUrl(ev.storage_path, 60, { download: ev.original_filename ?? true });
  if (error || !data) return new NextResponse("Not available", { status: 404 });

  const org = (ev.cases as unknown as { organization_id: string } | null)?.organization_id;
  if (org) {
    await supabase.rpc("log_activity", {
      p_org: org,
      p_case: ev.case_id,
      p_action: "evidence.downloaded",
      p_entity_type: "evidence",
      p_entity_id: ev.id,
      p_metadata: {},
    });
  }
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
