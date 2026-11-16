// src/api/saveFile.js
//
// One way to hand the user a document Octos made (16 Nov 2026): proformas,
// invoices, reports, statements.
//
// Inside the Octos desktop app, a browser-style download does nothing, so the
// app keeps the file in its own folder and opens it in the computer's PDF app,
// the way the inbox opens customers' files. The app's open_file takes only a
// number for the folder, and reuses a file already in that folder, so each
// document gets a fresh number (the time, in milliseconds): a report rebuilt
// after an edit never opens its old copy. The app clears its folder after a day.
//
// In a browser, it downloads; the link is kept for a minute, because taking it
// away straight after the click can cancel the download before it starts.
const desktopInvoke = () => window.__TAURI__?.core?.invoke

export async function saveFile(name, blob) {
  const invoke = desktopInvoke()
  if (invoke) {
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      await invoke('open_file', bytes, {
        headers: { 'x-file-id': String(Date.now()), 'x-file-name': encodeURIComponent(name) },
      })
    } catch (err) {
      // A download can't happen in the app, so say so rather than do nothing.
      window.alert(`${name} could not be opened. ${typeof err === 'string' ? err : 'Try again.'}`)
    }
    return
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
