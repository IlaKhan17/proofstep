/**
 * A confidence interval, drawn to scale.
 *
 * This is the page's recurring structural device, and it is here because it is what the product
 * outputs — not because the layout needed a graphic. It encodes three things a number alone cannot:
 * where the estimate sits, how wide the uncertainty is, and whether zero falls inside it. That last
 * one is the whole question: an interval straddling zero is a result you cannot act on, however bad
 * the point estimate looks.
 *
 * Geometry is computed from the values rather than hand-placed, so the bars cannot drift out of
 * agreement with the numbers printed beside them.
 */

export interface IntervalProps {
  /** Point estimate of the change. Negative is a regression. */
  estimate: number
  low: number
  high: number
  /** Axis bounds, shared across a group so bars are comparable to each other. */
  domain: [number, number]
  /** Whether the statistics support acting on this. Drives colour, not decoration. */
  significant: boolean
  /**
   * Read aloud in place of the drawing. Required, not optional: the interval bounds appear
   * nowhere else on the page, so a chart with no label silently drops the actual finding for
   * anyone using a screen reader. Colour is doing semantic work here too, which is why the
   * verdict is also printed as words beside the bar.
   */
  label: string
}

const pct = (value: number, [min, max]: [number, number]) =>
  `${((value - min) / (max - min)) * 100}%`

export function Interval({ estimate, low, high, domain, significant, label }: IntervalProps) {
  const zero = pct(0, domain)
  const tone = significant ? "bg-flag" : "bg-muted"
  const dot = significant ? "bg-flag" : "bg-ink"

  return (
    // `role="img"` with a label, rather than `aria-hidden`. Hiding it would be right if the
    // numbers were duplicated in text — they are not; the bounds live only here.
    <div className="relative h-7" role="img" aria-label={label}>
      {/* The axis, and zero on it. Zero is the reference the interval is judged against, so it
          is drawn as a real line rather than implied. */}
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule" />
      <div className="absolute top-0 bottom-0 w-px bg-rule" style={{ left: zero }} />

      {/* The interval itself, drawn from its own left edge outward. */}
      <div
        className="ci-draw absolute top-1/2 -translate-y-1/2 origin-left"
        style={{
          left: pct(low, domain),
          width: `calc(${pct(high, domain)} - ${pct(low, domain)})`,
        }}
      >
        <div className={`h-px w-full ${tone}`} />
        {/* Whisker caps. Without them the interval reads as a progress bar, which is the
            opposite of what it means. */}
        <div className={`absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 ${tone}`} />
        <div className={`absolute right-0 top-1/2 h-2.5 w-px -translate-y-1/2 ${tone}`} />
      </div>

      {/* The point estimate. */}
      <div
        className={`absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${dot}`}
        style={{ left: pct(estimate, domain) }}
      />
    </div>
  )
}
