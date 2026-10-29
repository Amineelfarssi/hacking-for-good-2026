/** @type {import('tailwindcss').Config} */
// Copied from rx-note-web/tailwind.config.ts (29 Oct 2026), trimmed to what this app uses:
// the same token names so the copied components/ui primitives and calm theme resolve.
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./lib/**/*.{js,ts,jsx,tsx,mdx}",
		"./hooks/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
			},
			fontSize: {
				xs: ["var(--fs-xs, 0.75rem)", { lineHeight: "1rem" }],
				sm: ["var(--fs-sm, 0.875rem)", { lineHeight: "1.25rem" }],
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			colors: {
				background: "hsl(var(--background))",
				foreground: "hsl(var(--foreground))",
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				primary: {
					DEFAULT: "hsl(var(--primary) / <alpha-value>)",
					foreground: "hsl(var(--primary-foreground))",
					ink: "hsl(var(--primary-ink) / <alpha-value>)",
				},
				secondary: {
					DEFAULT: "hsl(var(--secondary))",
					foreground: "hsl(var(--secondary-foreground))",
				},
				muted: {
					DEFAULT: "hsl(var(--muted))",
					foreground: "hsl(var(--muted-foreground))",
				},
				accent: {
					DEFAULT: "hsl(var(--accent))",
					foreground: "hsl(var(--accent-foreground))",
				},
				destructive: {
					DEFAULT: "hsl(var(--destructive))",
					foreground: "hsl(var(--destructive-foreground))",
				},
				border: "hsl(var(--border))",
				input: "hsl(var(--input))",
				ring: "hsl(var(--ring))",
				// Calm dashboard palette — warm paper, not clinical white. Values live in globals.css.
				canvas: "hsl(var(--canvas) / <alpha-value>)",
				sunken: "hsl(var(--sunken) / <alpha-value>)",
				line: "hsl(var(--line) / <alpha-value>)",
				divider: "hsl(var(--divider) / <alpha-value>)",
				hairline: "hsl(var(--hairline) / <alpha-value>)",
				selected: "hsl(var(--selected) / <alpha-value>)",
				ink: {
					DEFAULT: "hsl(var(--ink) / <alpha-value>)",
					soft: "hsl(var(--ink-soft) / <alpha-value>)",
					faint: "hsl(var(--ink-faint) / <alpha-value>)",
				},
			},
			keyframes: {
				"fade-up": {
					"0%": { opacity: "0", transform: "translateY(6px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
			},
			animation: {
				"fade-up": "fade-up 420ms cubic-bezier(.2,.8,.2,1) both",
			},
		},
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
