import Link from "next/link";
import { Fragment, type ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const ATTACK_PATH = /^https:\/\/attack\.mitre\.org\/(techniques|groups|mitigations|tactics)\/([A-Z]+\d{4})(?:\/(\d{3}))?\/?$/;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const [whole, label, url] = m;
    if (m.index! > last) nodes.push(text.slice(last, m.index));
    const attack = url!.match(ATTACK_PATH);
    if (attack && (attack[1] === "techniques" || attack[1] === "groups")) {
      const id = attack[3] ? `${attack[2]}.${attack[3]}` : attack[2]!;
      const href = attack[1] === "groups" ? `/attack/groups/${id}` : `/attack/${id}`;
      nodes.push(
        <Link key={`${m.index}-${id}`} href={href} className="text-primary underline-offset-2 hover:underline">
          {label}
        </Link>,
      );
    } else {
      // External references are shown as text only: the platform never opens third-party links.
      nodes.push(label);
    }
    last = m.index! + whole!.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Renders MITRE's markdown-ish descriptions as plain React nodes: paragraphs,
 * bullet lines and links to other ATT&CK objects (as internal links). No HTML
 * is ever injected.
 */
export function AttackText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className ?? "space-y-2 text-sm leading-relaxed"}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[*-]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^\s*[*-]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {renderInline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
