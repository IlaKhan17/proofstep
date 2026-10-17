import { QueryProvider } from "@/components/QueryProvider"
import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Proofstep",
  description: "Evaluation CI and trajectory testing for production AI agents",
  // No indexing: a dashboard reachable from the internet should not end up in a search
  // index, and trace names alone can disclose more than anyone intended.
  robots: { index: false, follow: false },
}

/**
 * Every route is rendered per request, and that is a correctness requirement rather than a
 * preference.
 *
 * `middleware.ts` issues a fresh CSP nonce per request and the policy is `'strict-dynamic'` with
 * no `'unsafe-inline'`. Next.js can only stamp that nonce onto its injected `<script>` tags while
 * rendering, so a statically prerendered page ships HTML whose scripts carry no nonce at all —
 * against a header that demands one. The browser then blocks every inline script on the page and
 * the result is a login form that renders and does nothing, with the explanation only visible in
 * the console.
 *
 * That is exactly what shipped: `/login`, `/signup`, `/forgot`, and `/` were prerendered, so
 * signing in was impossible in production while every dynamic page worked.
 *
 * Nothing is lost here. This is an authenticated dashboard; every page shows one user's data, so
 * there was no cache to benefit from prerendering in the first place.
 */
export const dynamic = "force-dynamic"

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <QueryProvider>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
              <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-6 py-3">
                <Link href="/traces" className="font-semibold tracking-tight text-slate-100">
                  Proofstep
                </Link>
                <nav className="flex gap-4 text-sm text-slate-400">
                  <Link href="/traces" className="hover:text-slate-100">
                    Traces
                  </Link>
                  <Link href="/experiments" className="hover:text-slate-100">
                    Experiments
                  </Link>
                  <Link href="/settings/keys" className="hover:text-slate-100">
                    Settings
                  </Link>
                </nav>
              </div>
            </header>
            <main className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  )
}
