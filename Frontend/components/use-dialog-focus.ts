'use client'
import { useEffect, type RefObject } from 'react'
export function useDialogFocus(ref: RefObject<HTMLElement | null>) {
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null
        const root = ref.current
        const elements = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
        elements()[0]?.focus()
        const trap = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return
            const items = elements(); const first = items[0]; const last = items.at(-1)
            if (!first) { event.preventDefault(); return }
            if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
            else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', trap)
        return () => { document.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus() }
    }, [ref])
}
