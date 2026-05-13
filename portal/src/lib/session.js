export const PORTAL_SESSION_EXPIRED_EVENT = 'portal:session-expired'
export const PORTAL_AUTH_STORAGE_KEY = 'portal-auth'

let sessionExpiryDispatched = false

export function dispatchSessionExpired() {
  if (sessionExpiryDispatched) return
  sessionExpiryDispatched = true
  window.dispatchEvent(new CustomEvent(PORTAL_SESSION_EXPIRED_EVENT))
}

export function resetSessionExpiryDispatch() {
  sessionExpiryDispatched = false
}
