import { runHeuristics } from "./heuristics";
import { enrichWithQwen, finalizeReview } from "./llm";
import { DEFAULT_RULES } from "./rules";
import type { ReviewResult, Rule } from "./types";

export async function reviewDocument(
  text: string,
  rules: Rule[] = DEFAULT_RULES,
): Promise<ReviewResult> {
  const seed = runHeuristics(text, rules);
  const { findings, used } = await enrichWithQwen(text, rules, seed);
  return finalizeReview(findings, used);
}
