"use client";

import { useMemo } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { linkifyCitations, type Citation } from "@/lib/citations";
import { unwrapTextMath } from "@/lib/math";
import { CitationChip } from "./citation-chip";

type Props = {
  text: string;
  onOpenCitation: (c: Citation) => void;
  /** Render as a span with no paragraph breaks (table cells). */
  inline?: boolean;
};

/** Streamed assistant text as markdown; citations become chips that open the source viewer; `$…$` renders as math. */
export function AnswerMarkdown({ text, onOpenCitation, inline }: Props) {
  const { markdown, citations } = useMemo(() => linkifyCitations(unwrapTextMath(text)), [text]);
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={inline ? "answer-md-inline" : "answer-md"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { output: "html", throwOnError: false }]]}
        // react-markdown drops unknown URL schemes; keep our internal cite: links.
        urlTransform={(url) => (url.startsWith("cite:") ? url : defaultUrlTransform(url))}
        components={{
          ...(inline ? { p: ({ children }) => <span>{children}</span> } : {}),
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
    </Wrapper>
  );
}
