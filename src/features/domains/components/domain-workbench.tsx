"use client";

import { Columns2, Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { options } from "@/lib/domain";
import { cn } from "@/lib/utils";

import { analyzeDomainAction, saveDomainAnalysisAction, type AnalyzeResult } from "../actions";
import { DomainReportView } from "./domain-report-view";

function Slot({ label, onResult }: { label: string; onResult: (r: AnalyzeResult | null) => void }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await analyzeDomainAction(value);
          if (!res.ok) {
            toast.error(res.error);
            onResult(null);
          } else {
            onResult(res.data);
            if (res.data.cached) toast.info("Risultato dalla cache (meno di 10 minuti).");
          }
        });
      }}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="example.com" aria-label={label} className="font-mono" autoComplete="off" spellCheck={false} />
      <Button type="submit" disabled={pending || !value.trim()}>
        {pending ? <Loader2 className="animate-spin" /> : <Search />} Analizza
      </Button>
    </form>
  );
}

export function DomainWorkbench({ cases }: { cases: (readonly [string, string])[] }) {
  const [compare, setCompare] = useState(false);
  const [a, setA] = useState<AnalyzeResult | null>(null);
  const [b, setB] = useState<AnalyzeResult | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Raccolta passiva dal backend: DNS e RDAP del registro. Il sito del dominio non viene mai visitato né scansionato.
          I domini riservati (example.com, *.example, *.test) restituiscono dati simulati.
        </p>
        <Button variant={compare ? "secondary" : "outline"} size="sm" onClick={() => setCompare((v) => !v)}>
          <Columns2 /> {compare ? "Analisi singola" : "Confronta due domini"}
        </Button>
      </div>

      <div className={cn("grid gap-4", compare && "xl:grid-cols-2")}>
        {[
          { label: "Dominio da analizzare", result: a, set: setA },
          ...(compare ? [{ label: "Secondo dominio", result: b, set: setB }] : []),
        ].map((slot) => (
          <Card key={slot.label}>
            <CardHeader>
              <CardTitle>{slot.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slot label={slot.label} onResult={slot.set} />
              {slot.result ? <DomainReportView report={slot.result.report} linkedCases={slot.result.linkedCases} /> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {compare && a && b ? (
        <Card>
          <CardHeader>
            <CardTitle>Confronto</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 pr-3">Elemento</th>
                  <th className="py-1.5 pr-3 font-mono">{a.report.domain}</th>
                  <th className="py-1.5 font-mono">{b.report.domain}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(
                  [
                    ["Modalità dati", (r: AnalyzeResult) => (r.report.dataMode === "live" ? "reale" : "simulata")],
                    ["A", (r: AnalyzeResult) => r.report.dns.A.join(", ") || "—"],
                    ["MX", (r: AnalyzeResult) => r.report.dns.MX.join(", ") || "—"],
                    ["NS", (r: AnalyzeResult) => r.report.dns.NS.join(", ") || "—"],
                    ["SPF", (r: AnalyzeResult) => r.report.dns.TXT.find((t) => t.startsWith("v=spf1")) ?? "—"],
                    ["DMARC", (r: AnalyzeResult) => r.report.dns.DMARC.join(" ") || "—"],
                    ["Registrar", (r: AnalyzeResult) => r.report.rdap?.registrar ?? "—"],
                    ["Registrazione", (r: AnalyzeResult) => r.report.rdap?.registration?.slice(0, 10) ?? "—"],
                    ["Osservazioni", (r: AnalyzeResult) => String(r.report.anomalies.length)],
                  ] as const
                ).map(([k, f]) => {
                  const va = f(a);
                  const vb = f(b);
                  return (
                    <tr key={k} className={va !== vb ? "bg-warning/5" : undefined}>
                      <td className="py-1.5 pr-3 text-muted-foreground">{k}</td>
                      <td className="py-1.5 pr-3 font-mono break-all">{va}</td>
                      <td className="py-1.5 font-mono break-all">{vb}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-muted-foreground">Le righe evidenziate differiscono tra i due domini.</p>
          </CardContent>
        </Card>
      ) : null}

      {!compare && a ? (
        <Card>
          <CardHeader>
            <CardTitle>Valutazione dell&apos;analista e salvataggio</CardTitle>
            <CardDescription>Il livello di rischio è un giudizio professionale motivato, non un calcolo automatico.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm key={a.report.domain + a.report.collectedAt} action={saveDomainAnalysisAction} successMessage="Analisi salvata" className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="domain" value={a.report.domain} />
              <FormField label="Livello di rischio" htmlFor="risk_level" required>
                <SelectInput name="risk_level" options={options.risks} placeholder="Seleziona…" />
              </FormField>
              <FormField label="Caso collegato" htmlFor="case_id">
                <SelectInput name="case_id" options={cases} placeholder="— Nessuno —" />
              </FormField>
              <FormField label="Motivazione del rischio" htmlFor="risk_rationale" required className="md:col-span-2">
                <TextArea name="risk_rationale" rows={3} placeholder="Quali elementi supportano la valutazione? Quali limiti?" />
              </FormField>
              <FormField label="Note dell'analista" htmlFor="analyst_notes" className="md:col-span-2">
                <TextArea name="analyst_notes" rows={3} />
              </FormField>
              <div className="md:col-span-2">
                <SubmitButton>Salva analisi</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
