/**
 * Documentation primitives.
 *
 * `Snippet` exists because a docs page is mostly commands, and a command a reader has to
 * reconstruct from prose is a command they will get wrong. Each one carries what it is for, so the
 * page can be skimmed by reading only the labels.
 */

export function Snippet({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <figure className="my-5">
      {label ? <figcaption className="mb-1.5 text-sm text-muted">{label}</figcaption> : null}
      <pre className="overflow-x-auto border border-rule bg-raised px-4 py-3 font-mono text-[0.8125rem] leading-relaxed">
        <code>{children}</code>
      </pre>
    </figure>
  )
}

/** A thing that will go wrong, said before it does. */
export function Warn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="my-6 border-l-2 border-flag pl-4">
      <p className="font-medium">{title}</p>
      <div className="mt-1 max-w-measure text-muted">{children}</div>
    </aside>
  )
}

export function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  // Numbered because this genuinely is a sequence — step four does not work before step three.
  return (
    <section className="border-t border-rule py-10">
      <h3 className="flex items-baseline gap-3 text-lg font-semibold tracking-tight">
        <span className="tnum font-mono text-sm font-normal text-muted">{n}</span>
        {title}
      </h3>
      <div className="mt-3 max-w-measure space-y-3 text-muted">{children}</div>
    </section>
  )
}
