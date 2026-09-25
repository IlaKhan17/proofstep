import { Footer, Header, REPO } from "@/components/Chrome"
import { Interval } from "@/components/Interval"
import Link from "next/link"

/**
 * The landing page.
 *
 * The hero is a real comparison, not a description of one. Two metrics both fell; one fall is
 * noise and one is a protected class collapsing, and the intervals are what tell them apart. That
 * is the product's entire argument, and it is the one thing a competitor's page cannot copy,
 * because they do not compute it.
 *
 * Everything below the hero is deliberately quiet. The boldness budget is spent in one place.
 */

// A shared axis, so the two bars are comparable to each other rather than each scaled to fit.
const DOMAIN: [number, number] = [-0.68, 0.06]

export default function Home() {
  return (
    <>
      <Header />
      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
          <h1 className="max-w-[34ch] text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-[3.25rem]">
            Your accuracy dropped two points. Is that real?
          </h1>
          <p className="mt-6 max-w-measure text-muted">
            Proofstep runs your evaluation suite in CI and gates the merge. Unlike a threshold
            check, it tests whether a change is larger than the noise in your own dataset — and
            tells you which of the two it saw.
          </p>

          {/* The measurement. */}
          <div className="mt-12 border border-rule bg-ground">
            <div className="flex items-baseline justify-between border-b border-rule px-5 py-3">
              <span className="font-mono text-[0.8125rem] text-muted">
                reply-intent, 40 examples, against main
              </span>
              <span className="font-mono text-[0.8125rem] text-muted">40 pairs</span>
            </div>

            <div className="divide-y divide-rule">
              <MetricRow
                name="intent_accuracy"
                baseline="0.913"
                candidate="0.892"
                delta="−0.021"
                estimate={-0.021}
                low={-0.061}
                high={0.019}
                p="0.31"
                verdict="not significant"
                significant={false}
                note="The interval crosses zero. This dataset cannot distinguish this change from
                      sampling noise, so the gate holds rather than blocking a merge on a coin flip."
              />
              <MetricRow
                name="classes_recall[unsubscribe]"
                baseline="0.991"
                candidate="0.412"
                delta="−0.579"
                estimate={-0.579}
                low={-0.634}
                high={-0.521}
                p="0.002"
                verdict="regression"
                significant
                note="Nowhere near zero. A protected class collapsed while the aggregate above it
                      barely moved — which is exactly the failure an average hides."
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-rule bg-raised px-5 py-3">
              <code className="font-mono text-[0.8125rem]">
                <span className="text-muted">$</span> proofstep eval reply-intent.yaml
              </code>
              <span className="font-mono text-[0.8125rem] font-medium text-flag">exit 1</span>
            </div>
          </div>

          <p className="mt-4 max-w-measure text-sm text-muted">
            The same numbers, the same verdict, and the same exit code appear in your dashboard — a
            parity suite fails the build if the two ever disagree.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <code className="border border-rule bg-raised px-3 py-2 font-mono text-sm">
              pip install proofstep-cli
            </code>
            <Link
              href="/docs"
              className="text-sm font-medium text-signal underline underline-offset-4"
            >
              Run it on your own suite
            </Link>
          </div>
        </section>

        {/* ── What it is ───────────────────────────────────────────────────────────── */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Two things, one verdict</h2>
            <div className="mt-8 grid gap-10 sm:grid-cols-2">
              <div>
                <h3 className="font-medium">Tracing, in production</h3>
                <p className="mt-2 max-w-measure text-muted">
                  Instrument an agent with six lines and every run becomes a trace: nested spans
                  across models, tools, and retrievers, with tokens and cost attached. Credentials
                  are stripped in the SDK before anything leaves your process, and again on the
                  server.
                </p>
                <p className="mt-3 max-w-measure text-sm text-muted">
                  Already on OpenTelemetry? Point your exporter at the OTLP endpoint and keep your
                  instrumentation.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Evaluation, in CI</h3>
                <p className="mt-2 max-w-measure text-muted">
                  Describe a suite in YAML — a dataset, an entrypoint, evaluators, gates. Proofstep
                  runs it, compares against the baseline for your branch, applies the gates, and
                  exits non-zero when a blocking one fails. Your pipeline needs no other integration
                  than the exit code.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Against the alternatives ─────────────────────────────────────────────── */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">
              What this does that the others don&rsquo;t
            </h2>
            <p className="mt-3 max-w-measure text-muted">
              Braintrust and Langfuse are good at what they are for. This is where Proofstep is
              actually different, stated narrowly enough to check.
            </p>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-rule">
                    <th className="py-3 pr-6 font-medium">&nbsp;</th>
                    <th className="py-3 pr-6 font-medium">Proofstep</th>
                    <th className="py-3 pr-6 font-normal text-muted">Braintrust</th>
                    <th className="py-3 font-normal text-muted">Langfuse</th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  <Row
                    what="Tests a regression for significance"
                    ours="Paired bootstrap, McNemar, Holm correction, and a minimum detectable effect when a suite is underpowered"
                    a="Threshold and comparison"
                    b="Threshold"
                  />
                  <Row
                    what="Gates a protected slice on its own floor"
                    ours="A slice gate is absolute, so a rare class cannot be averaged away"
                    a="Scores per example"
                    b="Scores per example"
                  />
                  <Row
                    what="One verdict everywhere"
                    ours="CLI and server call the same functions; a parity suite fails the build if they diverge"
                    a="Server computes"
                    b="Server computes"
                  />
                  <Row
                    what="Errors are not zeroes"
                    ours="An errored evaluation is an error and a missing metric is an ERROR verdict, never a silent pass"
                    a="Varies"
                    b="Varies"
                  />
                  <Row
                    what="Self-hostable"
                    ours="Apache-2.0, one compose file, images for amd64 and arm64"
                    a="Commercial"
                    b="Yes, open source"
                  />
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Honesty ──────────────────────────────────────────────────────────────── */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Where it is early</h2>
            <p className="mt-3 max-w-measure text-muted">
              Version 0.1.0. The evaluation engine, tracing, gates, and the dashboard work and are
              covered by 1,163 tests. These are the things you would otherwise find out yourself:
            </p>
            <ul className="mt-6 max-w-measure space-y-3 text-muted">
              <li className="border-l-2 border-rule pl-4">
                Throughput was measured on a developer laptop with every service sharing its cores,
                so the published numbers are a regression baseline rather than a capacity claim.
              </li>
              <li className="border-l-2 border-rule pl-4">
                Email is optional and unproven against a hosted relay. Invitations and password
                resets work without it, through whoever runs the install.
              </li>
              <li className="border-l-2 border-rule pl-4">
                Backups are logical snapshots with a verified restore. There is no point-in-time
                recovery.
              </li>
            </ul>
            <p className="mt-6 max-w-measure text-sm text-muted">
              The full list, including what was deliberately left undone and why, is in{" "}
              <a
                href={`${REPO}/blob/main/docs/HARDENING.md`}
                className="text-signal underline underline-offset-2"
              >
                HARDENING.md
              </a>
              .
            </p>
          </div>
        </section>

        {/* ── Start ────────────────────────────────────────────────────────────────── */}
        <section className="border-t border-rule">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Start</h2>
            <div className="mt-6 max-w-measure space-y-4 text-muted">
              <p>
                Run the whole stack on one host with Docker Compose, or install the SDK against an
                instance you already have. Both paths are in the docs, and the first takes about ten
                minutes.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              <Link
                href="/docs"
                className="bg-ink px-4 py-2.5 text-sm font-medium text-ground hover:bg-signal"
              >
                Read the docs
              </Link>
              <a
                href={REPO}
                className="border border-rule px-4 py-2.5 text-sm font-medium hover:border-ink"
              >
                Source on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function MetricRow({
  name,
  baseline,
  candidate,
  delta,
  estimate,
  low,
  high,
  p,
  verdict,
  significant,
  note,
}: {
  name: string
  baseline: string
  candidate: string
  delta: string
  estimate: number
  low: number
  high: number
  p: string
  verdict: string
  significant: boolean
  note: string
}) {
  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <code className="font-mono text-sm font-medium">{name}</code>
        <span className="tnum font-mono text-sm text-muted">
          {baseline} <span className="text-rule">→</span> {candidate}{" "}
          <span className={significant ? "font-medium text-flag" : "text-ink"}>{delta}</span>
        </span>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <Interval
          estimate={estimate}
          low={low}
          high={high}
          domain={DOMAIN}
          significant={significant}
          label={`${name} changed by ${delta}. 95% interval ${low} to ${high}, which ${
            significant ? "excludes" : "includes"
          } zero.`}
        />
        <div className="tnum flex items-baseline gap-3 font-mono text-[0.8125rem]">
          <span className="text-muted">p={p}</span>
          <span className={significant ? "font-medium text-flag" : "text-muted"}>{verdict}</span>
        </div>
      </div>

      <p className="mt-2 max-w-measure text-sm text-muted">{note}</p>
    </div>
  )
}

function Row({ what, ours, a, b }: { what: string; ours: string; a: string; b: string }) {
  return (
    <tr className="border-b border-rule">
      <th scope="row" className="py-4 pr-6 font-medium">
        {what}
      </th>
      <td className="py-4 pr-6">{ours}</td>
      <td className="py-4 pr-6 text-muted">{a}</td>
      <td className="py-4 text-muted">{b}</td>
    </tr>
  )
}
