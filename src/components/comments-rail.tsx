import { Check, Link2, Link2Off, Undo2 } from "lucide-react";
import {
  isLinkedComment,
  type CommentStatus,
  type DocComment,
  type MarkLevel,
} from "@/lib/doc-view";
import { ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const meta: Record<MarkLevel, { label: string; dot: string; ring: string }> = {
  3: { label: "HIGH", dot: "bg-crit", ring: "border-crit/60" },
  2: { label: "MEDIUM", dot: "bg-warn", ring: "border-warn/60" },
  1: { label: "LOW", dot: "bg-note", ring: "border-note/60" },
};

function CommentCard({
  comment: c,
  active,
  status,
  linkable,
  onSelect,
  onStatus,
}: {
  comment: DocComment;
  active: boolean;
  status: CommentStatus;
  linkable: boolean;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: CommentStatus) => void;
}) {
  const m = meta[c.severity];
  const rejected = status === "rejected";
  return (
    <div
      id={`comment-${c.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(c.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(c.id);
        }
      }}
      className={cn(
        "block w-full rounded-lg border bg-card p-4 text-left transition-all",
        linkable ? "cursor-pointer" : "cursor-default",
        active ? cn("border-foreground shadow-sm", m.ring) : "border-border hover:border-foreground/40",
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
            type="button"
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
            type="button"
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
      <p className="mt-2 text-[13px] leading-snug text-foreground/80">{c.ask}</p>
      {linkable ? (
        <p className="mt-3 inline-flex items-center gap-1 text-[12px] text-foreground">
          <Link2 className="size-3.5" />
          Перейти к месту в ТЗ
        </p>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
          <Link2Off className="size-3.5" />
          В документе нет якоря — раздел отсутствует или цитата не нашлась
        </p>
      )}
    </div>
  );
}

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
  const linked = comments.filter(isLinkedComment);
  const loose = comments.filter((c) => !isLinkedComment(c));

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-3 px-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          В тексте ТЗ · {linked.length}
        </p>
        {linked.length ? (
          <div className="space-y-3">
            {linked.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                active={activeId === c.id}
                status={statuses[c.id] ?? null}
                linkable
                onSelect={onSelect}
                onStatus={onStatus}
              />
            ))}
          </div>
        ) : (
          <p className="px-1 text-[12px] text-muted-foreground">
            Нет замечаний с местом в документе.
          </p>
        )}
      </section>
      <section>
        <p className="mb-3 px-1 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          Без места в документе · {loose.length}
        </p>
        {loose.length ? (
          <div className="space-y-3">
            {loose.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                active={activeId === c.id}
                status={statuses[c.id] ?? null}
                linkable={false}
                onSelect={onSelect}
                onStatus={onStatus}
              />
            ))}
          </div>
        ) : (
          <p className="px-1 text-[12px] text-muted-foreground">
            Все замечания привязаны к фрагменту.
          </p>
        )}
      </section>
    </div>
  );
}
