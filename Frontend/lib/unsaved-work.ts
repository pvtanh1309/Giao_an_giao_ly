export const beforeAppNavigation = 'giaoan:before-navigation'
export function canLeaveCurrentPage(): boolean {
    return window.dispatchEvent(new Event(beforeAppNavigation, { cancelable: true }))
}

// Track our same-document entries so cancelling Back/Forward restores the
// actual entry without replacing the lesson or discarding the forward stack.
export function guardHistoryNavigation(onChange: () => void, canLeave = canLeaveCurrentPage, target: Pick<Window, 'history' | 'addEventListener' | 'removeEventListener'> = window) {
    const history = target.history
    const key = '__giaoanHistoryIndex'
    let index = Number(history.state?.[key] ?? 0)
    let restoring = false
    const push = history.pushState
    const replace = history.replaceState
    replace.call(history, { ...history.state, [key]: index }, '')
    history.pushState = function (state, unused, url) { push.call(history, { ...state, [key]: ++index }, unused, url) }
    history.replaceState = function (state, unused, url) { replace.call(history, { ...state, [key]: index }, unused, url) }
    const pop = (event: PopStateEvent) => {
        if (restoring) { restoring = false; return }
        const next = Number(event.state?.[key] ?? index - 1)
        if (!canLeave()) {
            restoring = true
            history.go(index - next)
            return
        }
        index = next
        onChange()
    }
    target.addEventListener('popstate', pop as EventListener)
    return () => { target.removeEventListener('popstate', pop as EventListener); history.pushState = push; history.replaceState = replace }
}
