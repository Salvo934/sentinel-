import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createCaseAction } from "@/features/cases/actions";
import { CaseForm } from "@/features/cases/components/case-form";
import { getMembers } from "@/features/cases/data";
import { CASE_CATEGORY_VALUES, type CaseCategory } from "@/lib/domain";
import { requireActiveOrg } from "@/lib/org";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = { title: "Nuovo caso" };

export default async function NewCasePage({ searchParams }: PageProps<"/investigations/new">) {
  const { active, user } = await requireActiveOrg();
  const sp = await searchParams;
  // Prefill from missions ("Nuovo caso" links): category and title only.
  const category = firstParam(sp.category);
  const title = (firstParam(sp.title) ?? "").slice(0, 200);
  const prefCategory = (CASE_CATEGORY_VALUES as readonly string[]).includes(category ?? "") ? (category as CaseCategory) : undefined;
  const members = await getMembers(active.organizationId);
  return (
    <div className="space-y-6">
      <PageHeader title="Nuovo caso investigativo" back={{ href: "/investigations", label: "Investigations" }} />
      <Card>
        <CardContent>
          <CaseForm action={createCaseAction} members={members} initial={{ assigned_to: user.id, category: prefCategory, title: title || undefined }} submitLabel="Crea caso" />
        </CardContent>
      </Card>
    </div>
  );
}
