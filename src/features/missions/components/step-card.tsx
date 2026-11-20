"use client";

import { ArrowUpRight, CheckCircle2, Circle, GraduationCap, Lightbulb, Loader2, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { checkMissionStepAction } from "../actions";
import { CHECK_LABELS, resolveHref, type CheckResult, type MissionStep, type StepNote, type StepState } from "../types";

function labelOf(step: MissionStep, value: unknown): string {
  if (!step.quiz || step.quiz.type === "text") return String(value ?? "");
  const opts = step.quiz.options;
  const list = Array.isArray(value) ? value : [value];
  return list.map((v) => opts.find((o) => o.value === v)?.label ?? String(v)).join(" · ");
}

export function StepCard({
  index,
  step,
  runId,
  slug,
  caseId,
  state,
  note,
  active,
  locked,
}: {
  index: number;
  step: MissionStep;
  runId: string;
  slug: string;
  caseId: string | null;
  state?: StepState;
  note?: StepNote;
  active: boolean;
  locked: boolean;
}) {
  const [pending, start] = useTransition();
  const [single, setSingle] = useState<string>("");
  const [multi, setMulti] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const done = Boolean(state?.done);
  const href = step.module ? resolveHref(step.module.href, caseId) : null;

  const passedInfo: StepNote | null = result?.passed
    ? { explanation: result.explanation, senior: result.senior, correct_answer: result.correct_answer }
    : done
      ? (note ?? null)
      : null;
  const correct = result?.passed ? result.correct : state?.correct;

  function verify() {
    const answer = !step.quiz ? null : step.quiz.type === "single" ? single || null : step.quiz.type === "multi" ? multi : text;
    start(async () => {
      const res = await checkMissionStepAction(runId, slug, step.id, answer);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      if (res.data.passed) toast.success(`Passo ${index + 1} completato`);
    });
  }

  return (
    <li className={cn("rounded-xl border bg-card", active && !done && "ring-2 ring-primary/40", locked && "opacity-60")}>
      <details open={active || Boolean(result)}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
          {done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Completato" /> : <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">Passo {index + 1}</span>
          <span className="font-medium">{step.title}</span>
        </summary>
        <div className="space-y-4 border-t px-4 py-4">
          <p className="text-sm">{step.instruction}</p>

          <div className="flex flex-wrap items-center gap-2">
            {step.module ? (
              href ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={href} target={href.startsWith("http") ? "_blank" : undefined}>
                    {step.module.label} <ArrowUpRight />
                  </Link>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Collega prima un caso per aprire {step.module.label}.</span>
              )
            ) : null}
            {step.check && step.check.type !== "none" ? (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3" aria-hidden="true" /> Verifica automatica: {CHECK_LABELS[step.check.type] ?? step.check.type}
              </span>
            ) : null}
          </div>

          {step.think?.length ? (
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Lightbulb className="size-3.5" aria-hidden="true" /> Le domande che si fa un analista
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {step.think.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {step.quiz && !done && !result?.passed ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Domanda di verifica: {step.quiz.prompt}</legend>
              {step.quiz.type === "text" ? (
                <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi qui…" />
              ) : (
                step.quiz.options.map((o) => (
                  <label key={o.value} className="flex items-start gap-2 text-sm">
                    <input
                      type={step.quiz!.type === "multi" ? "checkbox" : "radio"}
                      name={`${step.id}-quiz`}
                      value={o.value}
                      checked={step.quiz!.type === "multi" ? multi.includes(o.value) : single === o.value}
                      onChange={(e) =>
                        step.quiz!.type === "multi"
                          ? setMulti((prev) => (e.target.checked ? [...prev, o.value] : prev.filter((x) => x !== o.value)))
                          : setSingle(o.value)
                      }
                      className="mt-1 size-4 shrink-0"
                    />
                    {o.label}
                  </label>
                ))
              )}
              {step.quiz.type === "multi" ? <p className="text-xs text-muted-foreground">Più risposte possibili.</p> : null}
            </fieldset>
          ) : null}

          {result && !result.passed ? (
            <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">{result.message}</p>
          ) : null}

          {!done && !result?.passed && !locked ? (
            <Button onClick={verify} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verifica il passo
            </Button>
          ) : null}

          {passedInfo ? (
            <div className="space-y-3">
              {step.quiz && step.quiz.type !== "text" ? (
                <div className={cn("rounded-lg border px-3 py-2 text-sm", correct ? "border-success/40 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
                  <p className="flex items-center gap-1.5 font-medium">
                    {correct ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                    {correct ? "Risposta corretta" : "Risposta da rivedere"}
                  </p>
                  {!correct && passedInfo.correct_answer !== undefined ? (
                    <p className="mt-1 text-xs">Risposta attesa: {labelOf(step, passedInfo.correct_answer)}</p>
                  ) : null}
                  {passedInfo.explanation ? <p className="mt-1 text-xs text-muted-foreground">{passedInfo.explanation}</p> : null}
                </div>
              ) : passedInfo.explanation ? (
                <p className="text-xs text-muted-foreground">{passedInfo.explanation}</p>
              ) : null}
              {passedInfo.senior ? (
                <div className="rounded-lg border-l-4 border-teal bg-teal/5 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-teal">
                    <GraduationCap className="size-4" aria-hidden="true" /> Come ha lavorato il senior
                  </p>
                  <p className="mt-1 text-sm">{passedInfo.senior}</p>
                </div>
              ) : null}
              {state?.answer && step.quiz?.type === "text" ? (
                <details>
                  <summary className="cursor-pointer text-xs text-primary">La tua risposta</summary>
                  <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{String(state.answer)}</p>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>
    </li>
  );
}
