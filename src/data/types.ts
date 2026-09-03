export type Severity = 3 | 2 | 1;

export type Block =
  | { type: "h2" | "h3" | "p" | "li"; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

export type Anchor = {
  block: number;
  /** Для таблиц: индекс строки (-1 = заголовок) и колонки */
  row?: number;
  col?: number;
  match: string;
};

export type Comment = {
  id: string;
  n: number;
  severity: Severity;
  place: string;
  quote: string;
  fix: string;
  anchors: Anchor[];
};

export type ReviewDoc = {
  id: string;
  title: string;
  keywords: string[];
  blocks: Block[];
  comments: Comment[];
};
