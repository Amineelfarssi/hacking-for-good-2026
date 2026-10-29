/**
 * Answers should not contain math markup, but a model sometimes writes `$\text{HCO}_3$`. Before markdown:
 * a `$…$` span that is nothing but `\text{…}` becomes the plain text (so "HCO3" does not turn into italic
 * math); anything else stays for KaTeX (remark-math + rehype-katex) to render.
 */
export function unwrapTextMath(text: string): string {
  return text.replace(/\$\\text\{([^{}$\\]*)\}\$/g, "$1").replace(/\$\\text\{([^{}$\\]*)\}_\{?(\d+)\}?\$/g, (_m, t: string, sub: string) => t + subscript(sub));
}

const SUBS: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
function subscript(digits: string): string {
  return digits.replace(/\d/g, (d) => SUBS[d] ?? d);
}
