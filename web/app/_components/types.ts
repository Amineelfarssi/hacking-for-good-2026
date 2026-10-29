import type { Protocol } from "@/lib/protocols";
import type { TrailEvent } from "@/lib/trail";
import type { AnswerScope } from "@/lib/decision-flow";

export type ViewerTarget = {
  protocol: Protocol;
  page: number;
  /** The plain PDF (served by /api/pdf/<id>). */
  url: string;
  /** The cited sentence, for the page highlighter. */
  query?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set while the assistant is still answering. */
  streaming?: boolean;
  /** The indicator text shown while a tool runs. */
  status?: string;
  error?: string;
  vote?: "up" | "down";
  /** Tool calls and results, for the navigation trail. */
  trail?: TrailEvent[];
  startedAt?: number;
  finishedAt?: number;
  /** The selection the question was asked against. */
  scope?: AnswerScope;
};
