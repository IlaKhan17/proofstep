import type { Config } from "tailwindcss"

/**
 * The palette of a plotted measurement.
 *
 * Two inks carry the product's argument rather than decorating it: `signal` marks a result the
 * statistics actually support, `muted` marks one they do not. That distinction is what Proofstep
 * computes, so it is what the page is coloured by.
 *
 * Deliberately not a warm-paper ground with a clay accent, and not near-black with one bright
 * accent. Both are competent and both are what every generated developer-tool page currently looks
 * like; a product about telling signal from noise should not arrive in the house style.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Faintly cool, like the background of a chart rather than a sheet of paper.
        ground: "#FCFCFD",
        raised: "#F4F6F8",
        // Genuinely navy. A tinted near-black (#0B0B0B, #111) is the tell it is standing in for.
        ink: "#111A26",
        rule: "#DDE2E8",
        muted: "#5F6B7A",
        // A measured result, and every interactive affordance.
        signal: "#1D4ED8",
        // A confirmed regression. A true signal red, not terracotta.
        flag: "#B42318",
      },
      fontFamily: {
        // Plex was designed for technical products and reads as engineering rather than as
        // startup. It is also not the face every generated page reaches for.
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        // Reserved for machine output: numbers, verdicts, exit codes, code. Never a decorative
        // label face — that use is what makes mono read as costume.
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      maxWidth: {
        measure: "62ch",
      },
    },
  },
} satisfies Config
