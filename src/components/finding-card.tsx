import type { Finding, Severity } from "@/lib/types";

const TONE: Record<
  Severity,
  { label: string; className: string }
> = {
  high: {
    label: "HIGH",
    className: "bg-[#fcebea] text-[#b42318] border-[#f0c4c0]",
  },
  medium: {
    label: "MEDIUM",
    className: "bg-[#fef3e2] text-[#b45309] border-[#f0d3a8]",
  },
  low: {
    label: "LOW",
    className: "bg-[#f1eee8] text-[#57534e] border-[#ddd4c6]",
  },
};

const ROLE: Record<Finding["role"], string> = {
  template: "шаблон",
  developer: "разработчик",
  qa: "тестировщик",
};

export function FindingCard({
  finding,
  index,
}: {
  finding: Finding;
  index: number;
}) {
  const tone = TONE[finding.severity];
  return (
    <article className="rounded-2xl border border-[#e8dfd0] bg-white p-4 shadow-[0_1px_0_rgba(28,25,21,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted">{index + 1}</span>
        <span
          className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${tone.className}`}
        >
          {tone.label}
        </span>
        {finding.ruleId ? (
          <span className="rounded-md bg-[#f4f0e8] px-1.5 py-0.5 font-mono text-[10px] text-muted">
            правило {finding.ruleId}
          </span>
        ) : null}
        <span className="text-[11px] text-muted">{ROLE[finding.role]}</span>
      </div>
      <p className="mt-2 text-sm font-semibold leading-snug text-ink">
        {finding.section}
      </p>
      <blockquote className="mt-2 border-l-2 border-[#d8cbb6] pl-3 font-mono text-[12px] leading-relaxed text-[#5c564c]">
        {finding.quote}
      </blockquote>
      <p className="mt-3 text-[13px] leading-relaxed text-ink">{finding.why}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#0f766e]">
        <span className="font-semibold">Уточнить: </span>
        {finding.ask}
      </p>
    </article>
  );
}
