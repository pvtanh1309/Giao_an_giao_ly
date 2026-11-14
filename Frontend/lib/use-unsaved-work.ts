'use client'

import { useEffect } from 'react'
import { beforeAppNavigation } from './unsaved-work'

const discardMessage = 'Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi và tiếp tục không?'

export function useUnsavedWork(dirty: boolean) {
    const confirmLeave = () => !dirty || window.confirm(discardMessage)

    useEffect(() => {
        if (!dirty) return
        const navigation = (event: Event) => { if (!event.defaultPrevented && !window.confirm(discardMessage)) event.preventDefault() }
        const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener(beforeAppNavigation, navigation)
        window.addEventListener('beforeunload', unload)
        return () => {
            window.removeEventListener(beforeAppNavigation, navigation)
            window.removeEventListener('beforeunload', unload)
        }
    }, [dirty])

    return confirmLeave
}
