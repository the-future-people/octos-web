// src/api/saveFile.js
//
// One way to hand the user a document Octos made (16 Nov 2026): proformas,
// invoices, reports, statements.
//
// Inside the Octos desktop app, a browser-style download does nothing, so
// downloads closed their window and stopped there (the proforma, 16 Nov).
// The app keeps the file in its own folder and opens it in the computer's
// PDF app instead, the same way the inbox opens customers' files. In a
// browser, it downloads; the link is kept for a minute, because taking it
// away straight after the click can cancel the download before it starts.
const desktopInvoke = () => window.__TAURI__?.core?.invoke

export async function saveFile(name, blob, key = name) {
  const invoke = desktopInvoke()
  if (invoke) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      await invoke('open_file', bytes, { headers: { 'x-file-id': String(key), 'x-file-name': encodeURIComponent(name) } })
      return
    } catch {
      // The app couldn't open it: fall back to a plain download.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
