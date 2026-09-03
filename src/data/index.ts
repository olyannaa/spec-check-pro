import { doc1 } from "./doc1";
import { doc2 } from "./doc2";
import { doc3 } from "./doc3";
import type { ReviewDoc } from "./types";

export const DOCS: ReviewDoc[] = [doc1, doc2, doc3];

/** Подбирает демонстрационный документ по имени файла или введённому тексту. */
export function matchDoc(input: string): ReviewDoc {
  const hay = input.toLowerCase().replace(/[_\s]+/g, " ");
  let best = DOCS[0]!;
  let bestScore = 0;
  for (const doc of DOCS) {
    let score = 0;
    for (const kw of doc.keywords) {
      const k = kw.toLowerCase().replace(/[_\s]+/g, " ");
      if (hay.includes(k)) score += k.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }
  return best;
}
