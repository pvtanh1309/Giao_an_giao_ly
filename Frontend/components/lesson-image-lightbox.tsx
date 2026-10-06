'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function LessonImageLightbox({
    src,
    alt,
    onClose,
    triggerRef,
}: {
    src: string
    alt: string
    onClose: () => void
    triggerRef: { current: HTMLImageElement | null }
}) {
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        closeButtonRef.current?.focus()
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
                window.requestAnimationFrame(() => triggerRef.current?.focus())
            }
            if (event.key === 'Tab') {
                event.preventDefault()
                closeButtonRef.current?.focus()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, triggerRef])

    const close = () => {
        onClose()
        window.requestAnimationFrame(() => triggerRef.current?.focus())
    }

    return (
        <div className="lesson-image-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
            <div className="lesson-image-lightbox-dialog" role="dialog" aria-modal="true" aria-label={alt || 'Ảnh minh họa phóng lớn'}>
                <button ref={closeButtonRef} className="lesson-image-lightbox-close" type="button" aria-label="Đóng ảnh phóng lớn" onClick={close}><X size={22} /></button>
                <img src={src} alt={alt} />
            </div>
        </div>
    )
}
