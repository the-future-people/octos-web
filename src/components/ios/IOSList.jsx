// src/components/ios/IOSList.jsx
//
// Inset grouped lists, as in iOS Settings (18 Nov 2026): a bold section
// title with an optional action, a rounded white card, and rows with a
// coloured icon square, a title, a quiet detail, a value and a chevron.

export function Section({ title, action, footer, children, className = '' }) {
  return (
    <section className={`px-4 mt-7 ${className}`}>
      {(title || action) && (
        <div className="flex items-end justify-between px-1 mb-2">
          {title && <h2 className="m-0 text-[20px] leading-[25px] font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="rounded-[12px] bg-[var(--ios-cell)] overflow-hidden">{children}</div>
      {footer && <p className="m-0 px-4 mt-2 text-[13px] leading-[18px] text-[var(--ios-secondary)]">{footer}</p>}
    </section>
  )
}

export function SectionAction({ children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="text-[17px] leading-[22px] text-[var(--ios-label)] opacity-90 active:opacity-50 flex items-center gap-1">
      {children}
      <Chevron className="opacity-50" />
    </button>
  )
}

export function Chevron({ className = '' }) {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d="M1.5 1.5L6.5 6.5L1.5 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Row({ icon, tint, title, detail, detailTone, value, badge, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`ios-row w-full flex items-center pl-4 text-left ${onClick ? 'ios-press' : ''}`}>
      {icon && (
        <span className="w-[30px] h-[30px] rounded-[7px] grid place-items-center text-white shrink-0
          [&>svg]:w-[17px] [&>svg]:h-[17px]" style={{ background: tint }}>
          {icon}
        </span>
      )}
      <span className={`ios-row-body flex-1 min-w-0 flex items-center gap-2 min-h-[56px] py-2 pr-4 ${icon ? 'ml-3' : ''}`}>
        <span className="flex-1 min-w-0">
          <span className="block text-[17px] leading-[22px] truncate">{title}</span>
          {detail && (
            <span className="block text-[13px] leading-[18px] truncate"
              style={{ color: detailTone || 'var(--ios-secondary)' }}>{detail}</span>
          )}
        </span>
        {badge ? (
          <span className="min-w-[28px] h-[24px] px-2 rounded-full grid place-items-center text-[15px] font-semibold text-white ios-num"
            style={{ background: badge }}>{value}</span>
        ) : value != null && (
          <span className="text-[17px] text-[var(--ios-secondary)] ios-num">{value}</span>
        )}
        {onClick && <Chevron className="text-[var(--ios-tertiary)]" />}
      </span>
    </Tag>
  )
}
