function freezeCommentsRail() {
  const rail = document.getElementById("comments-scroll");
  if (!rail) return () => {};
  const top = rail.scrollTop;
  return () => {
    rail.scrollTop = top;
  };
}

/** Scroll only the document pane. The comments rail stays where it is. */
export function scrollDocumentTo(id: string, fallbackBlock?: number) {
  const restoreRail = freezeCommentsRail();
  const pane = document.getElementById("doc-scroll");
  const target =
    document.getElementById(`mark-${id}`) ??
    (fallbackBlock != null
      ? document.getElementById(`doc-block-${fallbackBlock}`)
      : null) ??
    document.getElementById("doc-title");

  if (!target || !pane) {
    restoreRail();
    requestAnimationFrame(restoreRail);
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
  restoreRail();
  requestAnimationFrame(restoreRail);
  window.setTimeout(restoreRail, 80);
  window.setTimeout(restoreRail, 320);
}
