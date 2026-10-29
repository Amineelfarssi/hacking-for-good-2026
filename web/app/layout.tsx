import type { Metadata } from "next";
import { Nunito_Sans, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "katex/dist/katex.min.css";
import "./globals.css";

// Avenir Next (interface) and Tiempos (protocol content) are licensed faces, used when installed on the machine;
// these two free faces are their closest stand-ins everywhere else. The stacks live in tailwind.config.ts.
const sansFallback = Nunito_Sans({
  variable: "--font-sans-fallback",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
const serifFallback = Source_Serif_4({
  variable: "--font-serif-fallback",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OncoProtocol Assist",
  description:
    "Grounded search over BSPHO paediatric haemato-oncology protocols. Cites document and page; never guesses.",
};

// Sets the theme class before first paint so the night theme never flashes light.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sansFallback.variable} ${serifFallback.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* Browser extensions (password managers, VPNs) add attributes to <body> before React loads. */}
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
