import type { Comment, Severity } from "@/data/types";
import { cn } from "@/lib/utils";

const meta: Record<Severity, { label: string; dot: string; ring: string }> = {
  3: { label: "Критично", dot: "bg-crit", ring: "border-crit/60" },
  2: { label: "Важно", dot: "bg-warn", ring: "border-warn/60" },
  1: { label: "Уточнение", dot: "bg-note", ring: "border-note/60" },
};

export function CommentsRail({
  comments,
  activeId,
  onSelect,
}: {
  comments: Comment[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {comments.map((c) => {
        const m = meta[c.severity];
        const active = activeId === c.id;
        return (
          <button
            key={c.id}
            id={`comment-${c.id}`}
            onClick={() => onSelect(c.id)}
            className={cn(
              "block w-full rounded-lg border bg-card p-4 text-left transition-all",
              active ? cn("border-foreground shadow-sm", m.ring) : "border-border hover:border-foreground/40",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", m.dot)} />
              <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
                {m.label}
              </span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                #{c.n}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">{c.place}</p>
            <p className="mt-2 border-l-2 border-border pl-2 text-[12px] italic text-muted-foreground">
              {c.quote}
            </p>
            <p className="mt-2 text-[13px] leading-snug">{c.fix}</p>
          </button>
        );
      })}
    </div>
  );
}
