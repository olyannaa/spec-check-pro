import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  isLinkedComment,
  locate,
  type Block,
  type DocComment,
} from "@/lib/doc-view";
import { cn } from "@/lib/utils";

const PAGE_BODY_PX = 980;

type Loc = { block: number; row?: number; col?: number };

function anchorsFor(comments: DocComment[], loc: Loc) {
  const out: { match: string; comment: DocComment }[] = [];
  for (const c of comments) {
    for (const a of c.anchors) {
      if (a.cover !== "span") continue;
      if (a.block !== loc.block) continue;
      if ((a.row ?? null) !== (loc.row ?? null)) continue;
      if ((a.col ?? null) !== (loc.col ?? null)) continue;
      out.push({ match: a.match, comment: c });
    }
  }
  return out;
}

function tableFocus(comments: DocComment[], block: number, activeId: string | null) {
  const comment = comments.find((c) => c.id === activeId);
  if (!comment) return { table: false, rows: new Set<number>(), cells: new Set<string>(), level: 1 as const };
  const here = comment.anchors.filter((a) => a.block === block);
  const table = here.some((a) => a.cover === "block");
  return {
    table,
    rows: new Set(table ? [] : here.filter((a) => a.cover === "row").map((a) => a.row ?? 0)),
    cells: new Set(
      table
        ? []
        : here.filter((a) => a.cover === "cell").map((a) => `${a.row}:${a.col}`),
    ),
    level: comment.severity,
  };
}

function BlockShell({
  index,
  comments,
  activeId,
  className,
  as: Tag = "div",
  children,
}: {
  index: number;
  comments: DocComment[];
  activeId: string | null;
  className?: string;
  as?: "div" | "h1" | "h2" | "h3" | "p";
  children: ReactNode;
}) {
  const primaries = comments.filter((c) => c.anchors.some((a) => a.block === index));
  const active = comments.find(
    (c) => c.id === activeId && c.anchors.some((a) => a.block === index && a.cover === "block"),
  );
  return (
    <Tag
      id={`doc-block-${index}`}
      data-block={index}
      data-level={active?.severity}
      className={cn("relative scroll-mt-8", active && "doc-table-active", className)}
    >
      {primaries.map((c) => (
        <span
          key={c.id}
          id={`mark-${c.id}`}
          className="absolute top-0 left-0 size-0"
          aria-hidden
        />
      ))}
      {children}
    </Tag>
  );
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
  comments: DocComment[];
  loc: Loc;
  activeId: string | null;
  rejectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const anchors = anchorsFor(comments, loc);
  if (anchors.length === 0) return <>{text}</>;

  const ordered = [...anchors].sort((a, b) => {
    if (a.comment.id === activeId) return -1;
    if (b.comment.id === activeId) return 1;
    return 0;
  });

  const ranges: { start: number; end: number; comment: DocComment }[] = [];
  for (const a of ordered) {
    const found = locate(text, a.match);
    if (!found) continue;
    const { start, end } = found;
    if (ranges.some((r) => start < r.end && end > r.start)) continue;
    ranges.push({ start, end, comment: a.comment });
  }
  if (ranges.length === 0) {
    const primary = comments.find(
      (c) =>
        c.anchors[0] &&
        c.anchors[0].cover === "span" &&
        c.anchors[0].block === loc.block &&
        (c.anchors[0].row ?? null) === (loc.row ?? null) &&
        (c.anchors[0].col ?? null) === (loc.col ?? null) &&
        c.id === activeId,
    );
    if (primary && text.length) {
      ranges.push({
        start: 0,
        end: Math.min(text.length, 80),
        comment: primary,
      });
    }
  }
  if (ranges.length === 0) return <>{text}</>;
  ranges.sort((x, y) => x.start - y.start);

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) {
      parts.push(
        <Fragment key={`t${i}`}>{text.slice(cursor, r.start)}</Fragment>,
      );
    }
    const active = activeId === r.comment.id;
    const rejected = rejectedIds.has(r.comment.id);
    parts.push(
      <mark
        key={`m${i}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(r.comment.id);
        }}
        data-level={r.comment.severity}
        {...(active && !rejected ? { "data-active": "" } : {})}
        className={cn(
          "doc-hl text-foreground",
          rejected && "opacity-20 saturate-50",
        )}
        title={`Комментарий ${r.comment.n}`}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) {
    parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>);
  }
  return <>{parts}</>;
}

function BlockView({
  block,
  index,
  comments,
  activeId,
  rejectedIds,
  onSelect,
  editing,
  onEdit,
}: {
  block: Block;
  index: number;
  comments: DocComment[];
  activeId: string | null;
  rejectedIds: Set<string>;
  onSelect: (id: string) => void;
  editing: boolean;
  onEdit: (index: number, next: Block) => void;
}) {
  const shell = { index, comments, activeId };

  if (block.type === "table") {
    const focus = tableFocus(comments, index, activeId);
    return (
      <BlockShell {...shell} className="my-5 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {block.head.map((h, ci) => (
                <th
                  key={ci}
                  data-level={focus.cells.has(`-1:${ci}`) ? focus.level : undefined}
                  className={cn(
                    "border border-border bg-secondary px-3 py-2 text-left font-medium",
                    focus.cells.has(`-1:${ci}`) && "doc-cell-active",
                  )}
                >
                  {editing ? (
                    <input
                      value={h}
                      onChange={(e) => {
                        const head = [...block.head];
                        head[ci] = e.target.value;
                        onEdit(index, { ...block, head });
                      }}
                      className="w-full bg-transparent outline-none"
                    />
                  ) : (
                    h
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr
                key={ri}
                data-level={focus.rows.has(ri) ? focus.level : undefined}
                className={cn(focus.rows.has(ri) && "doc-row-active")}
              >
                {row.map((c, ci) => (
                  <td
                    key={ci}
                    data-level={focus.cells.has(`${ri}:${ci}`) ? focus.level : undefined}
                    className={cn(
                      "border border-border px-3 py-2 align-top",
                      focus.cells.has(`${ri}:${ci}`) && "doc-cell-active",
                    )}
                  >
                    {editing ? (
                      <input
                        value={c}
                        onChange={(e) => {
                          const rows = block.rows.map((r) => [...r]);
                          rows[ri]![ci] = e.target.value;
                          onEdit(index, { ...block, rows });
                        }}
                        className="w-full bg-transparent outline-none"
                      />
                    ) : (
                      c
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </BlockShell>
    );
  }

  if (editing) {
    return (
      <textarea
        data-block={index}
        value={block.text}
        rows={Math.max(1, Math.ceil(block.text.length / 78))}
        onChange={(e) => onEdit(index, { ...block, text: e.target.value })}
        className={cn(
          "my-1 w-full resize-none rounded-md border border-border bg-secondary/40 px-3 py-2 outline-none focus:border-foreground",
          block.type === "h1" && "text-2xl font-semibold",
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
      loc={{ block: index }}
      activeId={activeId}
      onSelect={onSelect}
      rejectedIds={rejectedIds}
    />
  );
  if (block.type === "h1") {
    return (
      <BlockShell {...shell} as="h1" className="mt-2 mb-4 text-2xl font-semibold tracking-tight">
        {inner}
      </BlockShell>
    );
  }
  if (block.type === "h2") {
    return (
      <BlockShell {...shell} as="h2" className="mt-8 mb-3 text-lg font-semibold tracking-tight">
        {inner}
      </BlockShell>
    );
  }
  if (block.type === "h3") {
    return (
      <BlockShell {...shell} as="h3" className="mt-6 mb-2 font-semibold">
        {inner}
      </BlockShell>
    );
  }
  if (block.type === "li") {
    return (
      <BlockShell {...shell} as="p" className="my-1 flex gap-2 pl-1">
        <span className="w-5 shrink-0 text-muted-foreground">
          {block.ordered && block.n ? `${block.n}.` : "•"}
        </span>
        <span>{inner}</span>
      </BlockShell>
    );
  }
  return (
    <BlockShell {...shell} as="p" className="my-3">
      {inner}
    </BlockShell>
  );
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
  comments: DocComment[];
  activeId: string | null;
  rejectedIds: Set<string>;
  onSelect: (id: string) => void;
  editing: boolean;
  onEdit: (index: number, next: Block) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageOf, setPageOf] = useState<number[]>([]);

  useLayoutEffect(() => {
    if (editing) {
      setPageOf([]);
      return;
    }
    const root = measureRef.current;
    if (!root) return;
    const nodes = [...root.querySelectorAll<HTMLElement>("[data-block]")];
    if (!nodes.length) {
      setPageOf([]);
      return;
    }
    let acc = 0;
    let page = 1;
    const next = nodes.map((el) => {
      const h = el.offsetHeight;
      if (acc > 80 && acc + h > PAGE_BODY_PX) {
        page += 1;
        acc = 0;
      }
      acc += h;
      return page;
    });
    setPageOf((prev) =>
      prev.length === next.length && prev.every((n, i) => n === next[i])
        ? prev
        : next,
    );
  }, [blocks, editing, title]);

  const pages = useMemo(() => {
    if (editing || !pageOf.length) return null;
    const groups: number[][] = [];
    pageOf.forEach((page, i) => {
      const idx = page - 1;
      if (!groups[idx]) groups[idx] = [];
      groups[idx]!.push(i);
    });
    return groups.filter((g) => g.length);
  }, [editing, pageOf]);

  const blockProps = {
    comments,
    activeId,
    rejectedIds,
    onSelect,
    editing,
    onEdit,
  };

  if (editing) {
    return (
      <article className="mx-auto max-w-[46rem] px-8 py-10 text-[15px] leading-relaxed">
        <h1 className="mb-8 border-b border-border pb-4 text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {blocks.map((block, i) => (
          <BlockView key={i} block={block} index={i} {...blockProps} />
        ))}
      </article>
    );
  }

  return (
    <div ref={measureRef} className="bg-secondary/50 px-4 py-8">
      {(pages ?? [blocks.map((_, i) => i)]).map((idxs, pageIdx, all) => (
        <section
          key={pageIdx}
          className="doc-page mx-auto mb-6 flex max-w-[46rem] flex-col bg-card px-10 pt-10 pb-8 text-[15px] leading-relaxed shadow-sm ring-1 ring-border"
        >
          {pageIdx === 0 ? (
            <h1
              id="doc-title"
              className="mb-8 border-b border-border pb-4 text-2xl font-semibold tracking-tight"
            >
              {title}
            </h1>
          ) : null}
          {idxs.map((i) => {
            const block = blocks[i];
            if (!block) return null;
            return <BlockView key={i} block={block} index={i} {...blockProps} />;
          })}
          {pageIdx === all.length - 1 ? (
            <MissingAnchors comments={comments} onSelect={onSelect} />
          ) : null}
          <p className="mt-auto pt-10 text-center font-mono text-[11px] tracking-wide text-muted-foreground">
            Страница {pageIdx + 1} из {all.length}
          </p>
        </section>
      ))}
    </div>
  );
}

function MissingAnchors({
  comments,
  onSelect,
}: {
  comments: DocComment[];
  onSelect: (id: string) => void;
}) {
  const loose = comments.filter((c) => !isLinkedComment(c));
  if (!loose.length) return null;
  return (
    <div className="mt-10 border-t border-border pt-6">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
        Общие замечания
      </p>
      <div className="space-y-2">
        {loose.map((c) => (
          <button
            key={c.id}
            type="button"
            id={`mark-${c.id}`}
            onClick={() => onSelect(c.id)}
            className="block w-full cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-left text-[13px] hover:border-foreground"
          >
            <span className="font-medium">{c.place}</span>
            <span className="mt-0.5 block text-muted-foreground">{c.ask}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
