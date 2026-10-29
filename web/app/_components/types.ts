import type { Protocol } from "@/lib/protocols";

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
};
