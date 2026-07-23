// ============================================================================
// Panel — the standard surface: navy card, hairline border, soft shadow,
// optional header row (title left, action right).
// ============================================================================

export default function Panel({ title, action, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section
      className={`rounded-xl border border-edge bg-panel shadow-[0_2px_16px_-8px_rgba(0,0,0,0.8)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-edge-soft">
          {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}
