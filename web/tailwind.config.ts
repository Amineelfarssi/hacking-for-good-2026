/** @type {import('tailwindcss').Config} */
// Token names match the components/ui primitives and the theme in app/globals.css.
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
				// Interface: Avenir Next where installed (every Mac), else Nunito Sans.
				sans: ['"Avenir Next"', "Avenir", "var(--font-sans-fallback)", "system-ui", "sans-serif"],
				// Protocol content (answers, document titles): Tiempos where installed, else Source Serif 4.
				serif: ['"Tiempos Text"', "var(--font-serif-fallback)", "Georgia", "serif"],
				// Large headings: Tiempos Headline is drawn for display sizes.
				display: ['"Tiempos Headline"', '"Tiempos Text"', "var(--font-serif-fallback)", "Georgia", "serif"],
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
					foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
					ink: "hsl(var(--primary-ink) / <alpha-value>)",
					soft: "hsl(var(--primary-soft) / <alpha-value>)",
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
				// Values live in globals.css; each has a dark counterpart.
				surface: "hsl(var(--surface) / <alpha-value>)",
				eosin: "hsl(var(--eosin) / <alpha-value>)",
				caution: {
					DEFAULT: "hsl(var(--caution) / <alpha-value>)",
					soft: "hsl(var(--caution-soft) / <alpha-value>)",
				},
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
				"slide-in-right": {
					"0%": { opacity: "0", transform: "translateX(16px)" },
					"100%": { opacity: "1", transform: "translateX(0)" },
				},
			},
			animation: {
				"fade-up": "fade-up 420ms cubic-bezier(.2,.8,.2,1) both",
				"slide-in-right": "slide-in-right 240ms cubic-bezier(.2,.8,.2,1) both",
			},
		},
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
