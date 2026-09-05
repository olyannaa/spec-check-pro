/** Scroll only the document pane so the comments rail does not jump. */
export function scrollDocumentTo(id: string, fallbackBlock?: number) {
  const pane = document.getElementById("doc-scroll");
  const target =
    document.getElementById(`mark-${id}`) ??
    (fallbackBlock != null
      ? document.getElementById(`doc-block-${fallbackBlock}`)
      : null) ??
    document.getElementById("doc-title");
  if (!target) return;

  if (!pane) {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const paneRect = pane.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const top =
    pane.scrollTop +
    (targetRect.top - paneRect.top) -
    paneRect.height / 2 +
    targetRect.height / 2;
  pane.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
