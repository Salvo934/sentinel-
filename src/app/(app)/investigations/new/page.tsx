import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createCaseAction } from "@/features/cases/actions";
import { CaseForm } from "@/features/cases/components/case-form";
import { getMembers } from "@/features/cases/data";
import { requireActiveOrg } from "@/lib/org";

export const metadata: Metadata = { title: "Nuovo caso" };

export default async function NewCasePage() {
  const { active, user } = await requireActiveOrg();
  const members = await getMembers(active.organizationId);
  return (
    <div className="space-y-6">
      <PageHeader title="Nuovo caso investigativo" back={{ href: "/investigations", label: "Investigations" }} />
      <Card>
        <CardContent>
          <CaseForm action={createCaseAction} members={members} initial={{ assigned_to: user.id }} submitLabel="Crea caso" />
        </CardContent>
      </Card>
    </div>
  );
}
