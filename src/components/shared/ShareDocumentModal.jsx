// src/components/shared/ShareDocumentModal.jsx
// One share sheet for any document Octos produces — a proforma, a weekly
// filing, an invoice. The caller supplies what it is and how to fetch it;
// everything else is the same wherever it appears.
//
// Only the working channel is coloured, so the eye goes to it rather than
// reading past two dead options. Neither of the others is wired:
// _deliver_invoice only stamps a status, and WhatsApp needs the Cloud API
// and its own SIM. They are shown rather than hidden so the shape is known.

import { createPortal } from 'react-dom'

export default function ShareDocumentModal({
  title,
  reference,
  onDownload,
  onClose,
  busy = false,
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}>
      <div className="bg-[var(--panel)] rounded-2xl shadow-2xl w-full max-w-sm
        overflow-hidden animate-slideUp" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <div className="text-sm font-bold text-[var(--text)]">{title}</div>
          {reference && (
            <div className="text-[11px] text-[var(--text-3)] font-mono mt-0.5">
              {reference}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-3 pb-3 pt-3">
          <button onClick={onDownload} disabled={busy}
            className="flex-1 bg-emerald-50 hover:bg-emerald-100 rounded-xl
              py-3.5 px-2 text-center transition-colors disabled:opacity-60">
            <div className="w-8 h-8 rounded-full bg-emerald-600 mx-auto mb-1.5
              flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="text-xs font-semibold text-emerald-900">
              {busy ? 'Building…' : 'Download'}
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">PDF</div>
          </button>

          <button disabled
            className="flex-1 bg-[var(--bg)] rounded-xl py-3.5 px-2 text-center
              opacity-55 cursor-not-allowed">
            <div className="w-8 h-8 rounded-full bg-[var(--border-dark)] mx-auto mb-1.5
              flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M17.5 14.4c-.3-.15-1.75-.87-2.02-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.7.3 1.26.48 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.22-3.74.99 1-3.65-.24-.38a9.86 9.86 0 0 1-1.51-5.26C2.16 6.45 6.6 2.01 12.05 2.01c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41z" />
              </svg>
            </div>
            <div className="text-xs font-semibold text-[var(--text-2)]">WhatsApp</div>
            <div className="text-[10px] text-[var(--text-3)] mt-0.5">Not connected</div>
          </button>

          <button disabled
            className="flex-1 bg-[var(--bg)] rounded-xl py-3.5 px-2 text-center
              opacity-55 cursor-not-allowed">
            <div className="w-8 h-8 rounded-full bg-[var(--border-dark)] mx-auto mb-1.5
              flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="22 6 12 13 2 6" />
              </svg>
            </div>
            <div className="text-xs font-semibold text-[var(--text-2)]">Email</div>
            <div className="text-[10px] text-[var(--text-3)] mt-0.5">Not connected</div>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}