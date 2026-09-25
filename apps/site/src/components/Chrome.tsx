import Link from "next/link"

export const REPO = "https://github.com/IlaKhan17/proofstep"

/**
 * Header and footer.
 *
 * The wordmark is set in mono at the same size as the navigation, not scaled up — the page's
 * claim is in the hero, and a large logo competing with it would spend attention on the least
 * informative thing on screen.
 */
export function Header() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-mono text-sm font-medium tracking-tight">
          proofstep
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/docs" className="text-muted hover:text-ink">
            Docs
          </Link>
          <a href={REPO} className="text-muted hover:text-ink">
            GitHub
          </a>
          <a href="https://pypi.org/project/proofstep/" className="text-muted hover:text-ink">
            PyPI
          </a>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted">
        <p className="max-w-measure">
          Proofstep is Apache-2.0 and self-hostable. What it does not yet do is written down in{" "}
          <a
            href={`${REPO}/blob/main/docs/HARDENING.md`}
            className="text-signal underline underline-offset-2"
          >
            HARDENING.md
          </a>
          , including the load numbers that were measured on a laptop rather than the reference
          hardware they are specified against.
        </p>
      </div>
    </footer>
  )
}
