import type { NodeViewRenderer } from '@tiptap/react'
import { clampLessonImageWidth } from '../lib/lesson-media.ts'

/** Keep resize previews in the DOM; record one undoable change on release. */
export const lessonImageNodeView: NodeViewRenderer = ({ node, editor, getPos }) => {
    let current = node
    let drag: { id: number; x: number; width: number; limit: number; direction: number; moved: boolean } | null = null
    const dom = document.createElement('span')
    dom.className = 'lesson-image-node'
    dom.contentEditable = 'false'
    const image = document.createElement('img')
    image.dataset.lessonImage = 'true'
    image.dataset.lessonImageTrigger = 'true'
    image.style.cssText = 'display:block;width:100%;height:auto;max-width:100%'
    image.setAttribute('role', 'button')
    image.tabIndex = 0
    const handle = document.createElement('button')
    handle.type = 'button'
    handle.className = 'lesson-image-resize-handle'
    handle.setAttribute('aria-label', 'Kéo để thay đổi kích thước ảnh; dùng phím mũi tên để chỉnh')
    handle.title = 'Kéo để đổi kích thước ảnh'
    dom.append(image, handle)

    const render = () => {
        const { src, alt, mediaId, width, alignment } = current.attrs
        if (src) image.setAttribute('src', src)
        else image.removeAttribute('src')
        image.alt = alt ?? ''
        image.setAttribute('aria-label', alt ? `Phóng lớn: ${alt}` : 'Phóng lớn ảnh minh họa')
        image.dataset.mediaId = mediaId ?? ''
        image.dataset.width = String(clampLessonImageWidth(width))
        image.dataset.alignment = alignment ?? 'center'
        dom.dataset.alignment = alignment ?? 'center'
        dom.style.width = `${clampLessonImageWidth(width)}px`
        dom.style.marginLeft = alignment === 'left' ? '0' : 'auto'
        dom.style.marginRight = alignment === 'right' ? '0' : 'auto'
    }
    const commit = (width: number) => {
        if (editor.isDestroyed) return
        const pos = getPos()
        if (typeof pos !== 'number') return
        const live = editor.state.doc.nodeAt(pos)
        if (live?.type !== current.type || live.attrs.mediaId !== current.attrs.mediaId) return
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, {
            ...live.attrs, width: clampLessonImageWidth(width),
        }))
    }
    const finish = (event: PointerEvent, save: boolean) => {
        if (!drag || event.pointerId !== drag.id) return
        const width = dom.getBoundingClientRect().width
        const moved = drag.moved
        drag = null
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
        if (save && moved) commit(width)
        render()
    }
    handle.addEventListener('pointerdown', (event) => {
        if (!editor.isEditable || event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        const pos = getPos()
        if (typeof pos !== 'number') return
        editor.commands.setNodeSelection(pos)
        const rect = dom.getBoundingClientRect()
        const parent = dom.parentElement
        const style = parent ? getComputedStyle(parent) : null
        const available = parent ? parent.clientWidth - parseFloat(style?.paddingLeft || '0') - parseFloat(style?.paddingRight || '0') : rect.width
        drag = { id: event.pointerId, x: event.clientX, width: rect.width, limit: available,
            direction: current.attrs.alignment === 'right' ? -1 : current.attrs.alignment === 'center' ? 2 : 1, moved: false }
        handle.setPointerCapture(event.pointerId)
    })
    handle.addEventListener('pointermove', (event) => {
        if (!drag || event.pointerId !== drag.id) return
        event.preventDefault()
        drag.moved ||= Math.abs(event.clientX - drag.x) > 2
        const width = clampLessonImageWidth(drag.width + (event.clientX - drag.x) * drag.direction)
        dom.style.width = `${Math.min(width, drag.limit)}px`
    })
    handle.addEventListener('pointerup', (event) => finish(event, true))
    handle.addEventListener('pointercancel', (event) => finish(event, false))
    handle.addEventListener('lostpointercapture', (event) => finish(event, false))
    handle.addEventListener('keydown', (event) => {
        if (!editor.isEditable || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        event.stopPropagation()
        commit(Number(current.attrs.width ?? 220) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1) * (event.shiftKey ? 10 : 1))
    })
    render()
    return {
        dom,
        update(next) {
            if (next.type !== current.type) return false
            current = next
            if (!drag) render()
            return true
        },
        selectNode: () => dom.classList.add('is-selected'),
        deselectNode: () => dom.classList.remove('is-selected'),
        stopEvent: (event) => event.target === handle,
        ignoreMutation: () => true,
        destroy() {
            const id = drag?.id
            drag = null
            if (id !== undefined && handle.hasPointerCapture(id)) handle.releasePointerCapture(id)
        },
    }
}
