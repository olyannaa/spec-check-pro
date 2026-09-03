import { Fragment, type ReactNode } from "react";
import type { Block, Comment, Severity } from "@/data/types";
import { cn } from "@/lib/utils";

const markClass: Record<Severity, string> = {
  3: "mark-3",
  2: "mark-2",
  1: "mark-1",
};

const markActiveClass: Record<Severity, string> = {
  3: "mark-3-active",
  2: "mark-2-active",
  1: "mark-1-active",
};

type Loc = { block: number; row?: number; col?: number };

function anchorsFor(comments: Comment[], loc: Loc) {
  const out: { match: string; comment: Comment }[] = [];
  for (const c of comments) {
    for (const a of c.anchors) {
      if (a.block !== loc.block) continue;
      if ((a.row ?? null) !== (loc.row ?? null)) continue;
      if ((a.col ?? null) !== (loc.col ?? null)) continue;
      out.push({ match: a.match, comment: c });
    }
  }
  return out;
}

function HighlightedText({
  text,
  comments,
  loc,
  activeId,
  rejectedIds,
  onSelect,
}: {
  text: string;
  comments: Comment[];
  loc: Loc;
  activeId: string | null;
  rejectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const anchors = anchorsFor(comments, loc);
  if (anchors.length === 0) return <>{text}</>;

  const ranges: { start: number; end: number; comment: Comment }[] = [];
  for (const a of anchors) {
    const start = text.indexOf(a.match);
    if (start === -1) continue;
    const end = start + a.match.length;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, comment: a.comment });
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((x, y) => x.start - y.start);

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, r.start)}</Fragment>);
    const active = activeId === r.comment.id;
    const dimmed = activeId !== null && !active;
    const rejected = rejectedIds.has(r.comment.id);
    parts.push(
      <mark
        key={`m${i}`}
        id={`mark-${r.comment.id}`}
        onClick={() => onSelect(r.comment.id)}
        className={cn(
          "cursor-pointer rounded-[3px] px-0.5 text-foreground transition-all",
          markClass[r.comment.severity],
          active && !rejected && markActiveClass[r.comment.severity],
          active && !rejected && "ring-2 ring-foreground/60 ring-offset-1",
          dimmed && "opacity-45",
          rejected && "opacity-20 saturate-50",
        )}
        title={`Комментарий ${r.comment.n}`}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  return <>{parts}</>;
}

export function DocumentPreview({
  title,
  blocks,
  comments,
  activeId,
  rejectedIds,
  onSelect,
  editing,
  onEdit,
}: {
  title: string;
  blocks: Block[];
  comments: Comment[];
  activeId: string | null;
  rejectedIds: Set<string>;
  onSelect: (id: string) => void;
  editing: boolean;
  onEdit: (index: number, next: Block) => void;
}) {
  return (
    <article className="mx-auto max-w-[46rem] px-8 py-10 text-[15px] leading-relaxed">
      <h1 className="mb-8 border-b border-border pb-4 text-2xl font-semibold tracking-tight">
        {title}
      </h1>

      {blocks.map((block, i) => {
        if (block.type === "table") {
          return (
            <div key={i} className="my-5 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {block.head.map((h, ci) => (
                      <th
                        key={ci}
                        className="border border-border bg-secondary px-3 py-2 text-left font-medium"
                      >
                        {editing ? (
                          <input
                            value={h}
                            onChange={(e) => {
                              const head = [...block.head];
                              head[ci] = e.target.value;
                              onEdit(i, { ...block, head });
                            }}
                            className="w-full bg-transparent outline-none"
                          />
                        ) : (
                          <HighlightedText
                            text={h}
                            comments={comments}
                            loc={{ block: i, row: -1, col: ci }}
                            activeId={activeId}
                            onSelect={onSelect}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((c, ci) => (
                        <td key={ci} className="border border-border px-3 py-2 align-top">
                          {editing ? (
                            <input
                              value={c}
                              onChange={(e) => {
                                const rows = block.rows.map((r) => [...r]);
                                rows[ri]![ci] = e.target.value;
                                onEdit(i, { ...block, rows });
                              }}
                              className="w-full bg-transparent outline-none"
                            />
                          ) : (
                            <HighlightedText
                              text={c}
                              comments={comments}
                              loc={{ block: i, row: ri, col: ci }}
                              activeId={activeId}
                              onSelect={onSelect}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (editing) {
          return (
            <textarea
              key={i}
              value={block.text}
              rows={Math.max(1, Math.ceil(block.text.length / 78))}
              onChange={(e) => onEdit(i, { ...block, text: e.target.value })}
              className={cn(
                "my-1 w-full resize-none rounded-md border border-border bg-secondary/40 px-3 py-2 outline-none focus:border-foreground",
                block.type === "h2" && "text-lg font-semibold",
                block.type === "h3" && "font-semibold",
              )}
            />
          );
        }

        const inner = (
          <HighlightedText
            text={block.text}
            comments={comments}
            loc={{ block: i }}
            activeId={activeId}
            onSelect={onSelect}
          />
        );

        if (block.type === "h2")
          return (
            <h2 key={i} className="mt-8 mb-3 text-lg font-semibold tracking-tight">
              {inner}
            </h2>
          );
        if (block.type === "h3")
          return (
            <h3 key={i} className="mt-6 mb-2 font-semibold">
              {inner}
            </h3>
          );
        if (block.type === "li")
          return (
            <p key={i} className="my-1 flex gap-2 pl-1">
              <span className="text-muted-foreground">—</span>
              <span>{inner}</span>
            </p>
          );
        return (
          <p key={i} className="my-3">
            {inner}
          </p>
        );
      })}
    </article>
  );
}
