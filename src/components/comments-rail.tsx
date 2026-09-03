import { Check, Undo2 } from "lucide-react";
import type { CommentStatus, DocComment, MarkLevel } from "@/lib/doc-view";
import { ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const meta: Record<MarkLevel, { label: string; dot: string; ring: string }> = {
  3: { label: "HIGH", dot: "bg-crit", ring: "border-crit/60" },
  2: { label: "MEDIUM", dot: "bg-warn", ring: "border-warn/60" },
  1: { label: "LOW", dot: "bg-note", ring: "border-note/60" },
};

export function CommentsRail({
  comments,
  activeId,
  statuses,
  onSelect,
  onStatus,
}: {
  comments: DocComment[];
  activeId: string | null;
  statuses: Record<string, CommentStatus>;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: CommentStatus) => void;
}) {
  return (
    <div className="space-y-3">
      {comments.map((c) => {
        const m = meta[c.severity];
        const active = activeId === c.id;
        const status = statuses[c.id];
        const rejected = status === "rejected";
        return (
          <div
            key={c.id}
            id={`comment-${c.id}`}
            onClick={() => onSelect(c.id)}
            className={cn(
              "block w-full cursor-pointer rounded-lg border bg-card p-4 text-left transition-all",
              active
                ? cn("border-foreground shadow-sm", m.ring)
                : "border-border hover:border-foreground/40",
              rejected && "opacity-45",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", m.dot)} />
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {m.label}
              </span>
              <span className="rounded-sm border border-border px-1.5 py-px text-[10px] text-muted-foreground">
                {ROLE_LABELS[c.role]}
              </span>
              {c.ruleId ? (
                <span className="font-mono text-[10px] text-muted-foreground">
                  правило {c.ruleId}
                </span>
              ) : null}
              <span className="ml-auto flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatus(c.id, status === "accepted" ? null : "accepted");
                  }}
                  aria-label="Принять"
                  title="Принять"
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
                    status === "accepted"
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatus(c.id, rejected ? null : "rejected");
                  }}
                  aria-label="Отозвать"
                  title="Отозвать"
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-md border transition-colors",
                    rejected
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
                  )}
                >
                  <Undo2 className="size-3.5" />
                </button>
              </span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">{c.place}</p>
            <p className="mt-1 text-[13px] leading-snug">{c.why}</p>
            <p className="mt-2 text-[13px] leading-snug text-foreground/80">
              {c.ask}
            </p>
          </div>
        );
      })}
    </div>
  );
}
