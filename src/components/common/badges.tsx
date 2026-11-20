import { FlaskConical } from "lucide-react";

import { ToneBadge } from "@/components/common/tone-badge";
import {
  CASE_STATUSES,
  CASE_STATUS_TONE,
  CONFIDENCE,
  INFO_STATUSES,
  INFO_STATUS_TONE,
  PRIORITIES,
  PRIORITY_TONE,
  RELIABILITY,
  RISK_LEVELS,
  RISK_TONE,
  VERDICTS,
  VERDICT_TONE,
  type CaseStatus,
  type Confidence,
  type InfoStatus,
  type Priority,
  type Reliability,
  type RiskLevel,
  type Verdict,
} from "@/lib/domain";

export const CaseStatusBadge = ({ value }: { value: CaseStatus }) => (
  <ToneBadge tone={CASE_STATUS_TONE[value]}>{CASE_STATUSES[value]}</ToneBadge>
);
export const PriorityBadge = ({ value }: { value: Priority }) => (
  <ToneBadge tone={PRIORITY_TONE[value]}>Priorità {PRIORITIES[value].toLowerCase()}</ToneBadge>
);
export const RiskBadge = ({ value }: { value: RiskLevel | null }) =>
  value ? <ToneBadge tone={RISK_TONE[value]}>Rischio {RISK_LEVELS[value].toLowerCase()}</ToneBadge> : null;
export const InfoStatusBadge = ({ value }: { value: InfoStatus }) => (
  <ToneBadge tone={INFO_STATUS_TONE[value]}>{INFO_STATUSES[value]}</ToneBadge>
);
export const VerdictBadge = ({ value }: { value: Verdict }) => (
  <ToneBadge tone={VERDICT_TONE[value]}>{VERDICTS[value]}</ToneBadge>
);
export const ReliabilityBadge = ({ value }: { value: Reliability }) => (
  <ToneBadge tone={value <= "B" ? "success" : value <= "C" ? "info" : value === "F" ? "neutral" : "warning"} title={RELIABILITY[value]}>
    Affidabilità {value}
  </ToneBadge>
);
export const ConfidenceBadge = ({ value }: { value: Confidence }) => (
  <ToneBadge tone={value === "high" ? "success" : value === "moderate" ? "info" : "neutral"}>
    Confidenza {CONFIDENCE[value].toLowerCase()}
  </ToneBadge>
);
export const DemoBadge = ({ show = true }: { show?: boolean }) =>
  show ? (
    <ToneBadge tone="warning" title="Dato simulato della modalità demo">
      <FlaskConical className="size-3" aria-hidden="true" /> Demo
    </ToneBadge>
  ) : null;
