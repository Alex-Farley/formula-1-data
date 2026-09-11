/**
 * The page a reader asked for while the database was still arriving.
 *
 * During the download the prerendered page's links are real anchors, and a
 * click on one used to be a full navigation that threw the in-flight
 * download away and started it again. main.jsx now turns that click into a
 * route change and records what was asked for here, so the boot strip can
 * say "opening Drivers when it is ready" instead of the page silently
 * changing shape later.
 */
let pending = null
const listeners = new Set()

export function setPending(label) {
  pending = label
  for (const listener of listeners) listener(pending)
}

export function onPending(listener) {
  listeners.add(listener)
  listener(pending)
  return () => listeners.delete(listener)
}
