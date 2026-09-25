import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Proofstep — evaluation CI for AI agents",
  description:
    "Quality gates that tell you whether a regression is real or noise. Paired significance testing, one verdict in CI and the dashboard, self-hostable.",
  openGraph: {
    title: "Proofstep — evaluation CI for AI agents",
    description: "Quality gates that tell you whether a regression is real or noise.",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Two weights of each face, no more. Every extra weight is a request on a page whose
            whole argument is precision. `display=swap` so text is readable before they land. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-ground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
