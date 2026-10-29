"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyCitations, type Citation } from "@/lib/citations";
import { CitationChip } from "./citation-chip";

/** Streamed assistant text as markdown; citations become chips that open the source viewer. */
export function AnswerMarkdown({ text, onOpenCitation }: { text: string; onOpenCitation: (c: Citation) => void }) {
  const { markdown, citations } = useMemo(() => linkifyCitations(text), [text]);
  return (
    <div className="answer-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("cite:")) {
              const c = citations[Number(href.slice(5))];
              if (c) return <CitationChip citation={c} onClick={() => onOpenCitation(c)} />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
