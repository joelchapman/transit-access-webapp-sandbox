/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    // hover: styles only apply on devices that can hover, so taps don't leave them stuck
    future: { hoverOnlyWhenSupported: true },
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
  		},
  		fontFamily: {
  			sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif']
  		},
  		// iOS-style type scale; display/title are for large figures and headings
  		fontSize: {
  			display: ['2.75rem', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '700' }],
  			// Large figures set beside each other, e.g. the legend's live counts
  			stat: ['2rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '600' }],
  			title: ['1.375rem', { lineHeight: '1.2', letterSpacing: '-0.015em', fontWeight: '700' }],
  			headline: ['1.0625rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
  			body: ['1rem', { lineHeight: '1.4' }],
  			subhead: ['0.9375rem', { lineHeight: '1.4' }],
  			footnote: ['0.8125rem', { lineHeight: '1.35' }],
  			caption: ['0.75rem', { lineHeight: '1.3' }]
  		},
  		boxShadow: {
  			raised: 'var(--shadow-raised)',
  			floating: 'var(--shadow-floating)',
  			sheet: 'var(--shadow-sheet)',
  			overlay: 'var(--shadow-overlay)',
  			'on-photo': 'var(--shadow-on-photo)',
  			badge: 'var(--shadow-badge)',
  			scrolled: 'var(--shadow-scrolled)'
  		},
  		borderRadius: {
  			sheet: 'var(--radius-sheet)',
  			xl: 'calc(var(--radius) + 4px)',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			status: {
  				ok: 'oklch(var(--status-ok) / <alpha-value>)',
  				'ok-foreground': 'oklch(var(--status-ok-foreground) / <alpha-value>)',
  				'ok-muted': 'oklch(var(--status-ok-muted) / <alpha-value>)',
  				partial: 'oklch(var(--status-partial) / <alpha-value>)',
  				'partial-foreground': 'oklch(var(--status-partial-foreground) / <alpha-value>)',
  				'partial-muted': 'oklch(var(--status-partial-muted) / <alpha-value>)',
  				out: 'oklch(var(--status-out) / <alpha-value>)',
  				'out-foreground': 'oklch(var(--status-out-foreground) / <alpha-value>)',
  				'out-muted': 'oklch(var(--status-out-muted) / <alpha-value>)',
  				'out-on': 'oklch(var(--status-out-on) / <alpha-value>)'
  			},
  			'access-tip': {
  				DEFAULT: 'oklch(var(--access-tip) / <alpha-value>)',
  				foreground: 'oklch(var(--access-tip-foreground) / <alpha-value>)'
  			},
  			// Tints of the text color, so they read on any surface: quiet fills and hover/press feedback
  			'fill-subtle': 'oklch(var(--foreground) / 0.06)',
  			'state-hover': 'oklch(var(--foreground) / 0.04)',
  			'state-press': 'oklch(var(--foreground) / 0.08)',
  			'state-press-strong': 'oklch(var(--foreground) / 0.12)',
  			handle: 'oklch(var(--foreground) / 0.2)',
  			background: 'oklch(var(--background) / <alpha-value>)',
  			foreground: 'oklch(var(--foreground) / <alpha-value>)',
  			card: {
  				DEFAULT: 'oklch(var(--card) / <alpha-value>)',
  				foreground: 'oklch(var(--card-foreground) / <alpha-value>)'
  			},
  			popover: {
  				DEFAULT: 'oklch(var(--popover) / <alpha-value>)',
  				foreground: 'oklch(var(--popover-foreground) / <alpha-value>)'
  			},
  			primary: {
  				DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
  				foreground: 'oklch(var(--primary-foreground) / <alpha-value>)'
  			},
  			secondary: {
  				DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
  				foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)'
  			},
  			muted: {
  				DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
  				foreground: 'oklch(var(--muted-foreground) / <alpha-value>)'
  			},
  			accent: {
  				DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
  				foreground: 'oklch(var(--accent-foreground) / <alpha-value>)'
  			},
  			destructive: {
  				DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
  				foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)'
  			},
  			border: 'oklch(var(--border) / <alpha-value>)',
  			input: 'oklch(var(--input) / <alpha-value>)',
  			ring: 'oklch(var(--ring) / <alpha-value>)',
  			chart: {
  				'1': 'oklch(var(--chart-1) / <alpha-value>)',
  				'2': 'oklch(var(--chart-2) / <alpha-value>)',
  				'3': 'oklch(var(--chart-3) / <alpha-value>)',
  				'4': 'oklch(var(--chart-4) / <alpha-value>)',
  				'5': 'oklch(var(--chart-5) / <alpha-value>)'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
