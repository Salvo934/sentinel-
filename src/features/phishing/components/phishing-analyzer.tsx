"use client";

import { FileUp, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { options } from "@/lib/domain";

import { savePhishingAnalysisAction } from "../actions";
import { analyzeEmail } from "../parser";
import { PHISHING_SAMPLES } from "../samples";
import { AnalysisView } from "./analysis-view";

const MAX_FILE = 1024 * 1024;

export function PhishingAnalyzer({ cases, initialSample }: { cases: (readonly [string, string])[]; initialSample?: string }) {
  const start = PHISHING_SAMPLES.find((s) => s.key === initialSample);
  const [raw, setRaw] = useState(start?.raw ?? "");
  const [mode, setMode] = useState<"paste" | "upload" | "training_sample">(start ? "training_sample" : "paste");
  const [sampleKey, setSampleKey] = useState(start?.key ?? "");
  const [title, setTitle] = useState(start ? `[Training] ${start.label}` : "");
  const [analyzed, setAnalyzed] = useState<string | null>(start?.raw ?? null);
  const analysis = useMemo(() => (analyzed ? analyzeEmail(analyzed) : null), [analyzed]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE) return toast.error("File troppo grande (max 1 MB).");
    if (!/\.(eml|txt)$/i.test(file.name)) return toast.error("Formati ammessi: .eml o .txt");
    // Read as text only: nothing is decoded, rendered or executed.
    const text = await file.text();
    setRaw(text);
    setMode("upload");
    setSampleKey("");
    setTitle(file.name.replace(/\.(eml|txt)$/i, ""));
    setAnalyzed(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>1. Messaggio da analizzare</CardTitle>
          <CardDescription>Usa solo esempi sanitizzati. Il contenuto è trattato come testo: link e allegati non vengono mai aperti.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              aria-label="Campione formativo"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30 [&>option]:bg-popover"
              value={sampleKey}
              onChange={(e) => {
                const s = PHISHING_SAMPLES.find((x) => x.key === e.target.value);
                setSampleKey(e.target.value);
                if (s) {
                  setRaw(s.raw);
                  setMode("training_sample");
                  setTitle(`[Training] ${s.label}`);
                  setAnalyzed(null);
                }
              }}
            >
              <option value="">Modalità training: scegli un&apos;email simulata…</option>
              {PHISHING_SAMPLES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button asChild variant="outline" size="default">
              <label className="cursor-pointer">
                <FileUp /> Carica .eml / .txt
                <input type="file" accept=".eml,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
            </Button>
          </div>
          {sampleKey ? <p className="text-xs text-muted-foreground">{PHISHING_SAMPLES.find((s) => s.key === sampleKey)?.scenario}</p> : null}
          <TextArea
            name="raw_preview"
            aria-label="Sorgente del messaggio (header e corpo)"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (mode === "training_sample") setMode("paste");
              setSampleKey("");
            }}
            rows={16}
            className="font-mono text-xs"
            placeholder="Incolla qui il sorgente completo (header + corpo) del messaggio…"
            spellCheck={false}
          />
          <Button onClick={() => (raw.trim().length < 20 ? toast.error("Inserisci il messaggio completo") : setAnalyzed(raw))}>
            <ScanLine /> Analizza
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>2. Risultati dell&apos;analisi statica</CardTitle>
            <CardDescription>Indicatori automatici a supporto: il verdetto resta dell&apos;analista.</CardDescription>
          </CardHeader>
          <CardContent>{analysis ? <AnalysisView analysis={analysis} /> : <p className="text-sm text-muted-foreground">Premi «Analizza» per vedere i risultati.</p>}</CardContent>
        </Card>

        {analysis && analyzed === raw ? (
          <Card>
            <CardHeader>
              <CardTitle>3. Valutazione e salvataggio</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionForm action={savePhishingAnalysisAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="raw_message" value={raw} />
                <input type="hidden" name="input_mode" value={mode} />
                <input type="hidden" name="sample_key" value={sampleKey} />
                <FormField label="Titolo dell'analisi" htmlFor="title" required className="sm:col-span-2">
                  <TextInput name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </FormField>
                <FormField label="Verdetto dell'analista" htmlFor="verdict">
                  <SelectInput name="verdict" options={options.verdicts} defaultValue="undetermined" />
                </FormField>
                <FormField label="Confidenza" htmlFor="confidence">
                  <SelectInput name="confidence" options={options.confidence} defaultValue="moderate" />
                </FormField>
                <FormField label="Caso collegato" htmlFor="case_id" className="sm:col-span-2">
                  <SelectInput name="case_id" options={cases} placeholder="— Nessuno —" />
                </FormField>
                <FormField label="Valutazione motivata" htmlFor="analyst_assessment" className="sm:col-span-2">
                  <TextArea name="analyst_assessment" rows={4} placeholder="Evidenze principali, verdetto, limiti dell'analisi…" />
                </FormField>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="register_iocs" className="size-4" /> Registra URL, domini e IP estratti nel registro IOC
                </label>
                <div className="sm:col-span-2">
                  <SubmitButton>Salva analisi</SubmitButton>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
