export const AUTH_CHANGED_EVENT = 'prepai:auth-changed'

export function emitAuthChanged(user) {
  window.dispatchEvent(
    new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: user || null,
    }),
  )
}
