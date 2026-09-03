export type Severity = "high" | "medium" | "low";
export type ReviewRole = "template" | "developer" | "qa";
export type Verdict = "ready" | "needs_work" | "not_ready";

export const ROLE_LABELS: Record<ReviewRole, string> = {
  template: "Шаблон",
  developer: "Разработчик",
  qa: "QA",
};

export type Rule = {
  id: string;
  title: string;
  lookFor: string;
  askIfMissing: string;
};

export type Finding = {
  id: string;
  severity: Severity;
  ruleId?: string;
  section: string;
  quote: string;
  sourceQuotes?: string[];
  why: string;
  ask: string;
  role: ReviewRole;
};

export type ReviewResult = {
  verdict: Verdict;
  summary: string;
  findings: Finding[];
  counts: { high: number; medium: number; low: number };
  model: string;
  usedLlm: boolean;
  llmCalls: number;
  rolesRan: ReviewRole[];
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text?: string;
  fileName?: string;
  review?: ReviewResult;
  rulesUpdated?: boolean;
};
