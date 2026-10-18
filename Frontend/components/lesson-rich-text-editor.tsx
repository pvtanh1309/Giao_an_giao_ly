'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { useRef, useState } from 'react'
import { lessonEditorExtensions, parseLessonDocument } from './rich-text-extensions'
import { RichTextToolbar } from './rich-text-toolbar'
import { LessonImageLightbox } from './lesson-image-lightbox'
import { useLessonNotes } from './lesson-notes-context'
import { lessonTextMap, selectedNoteRange, selectionIsWithinField } from '../lib/lesson-note-selection'
import { resolveLessonNoteAnchor } from '../lib/lesson-note-anchors'
import { LessonNotesDecorations, lessonNotesKey } from '../lib/lesson-note-decorations'

type LessonRichTextEditorProps = {
    content: string
    editable?: boolean
    ariaLabel?: string
    toolbarMode?: 'lesson' | 'program-schedule' | 'reference'
    compact?: boolean
    lessonId?: string
    noteFieldId?: string
    getAccessToken?: () => Promise<string>
    mediaApiBaseUrl?: string
    onChange?: (content: string) => void
    onUploadStateChange?: (uploading: boolean) => void
}

export function LessonRichTextEditor({
    content,
    editable = true,
    ariaLabel,
    toolbarMode = 'lesson',
    compact = false,
    lessonId,
    noteFieldId,
    getAccessToken,
    mediaApiBaseUrl = process.env.NEXT_PUBLIC_CONTENT_API_URL ?? '',
    onChange,
    onUploadStateChange,
}: LessonRichTextEditorProps) {
    const notes = useLessonNotes()
    const editor = useEditor({
        extensions: [...lessonEditorExtensions, LessonNotesDecorations],
        content: parseLessonDocument(content),
        editable,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                'aria-label': ariaLabel ?? (editable ? 'Nội dung bài giáo án' : 'Nội dung giáo án'),
                role: 'textbox',
                'aria-multiline': 'true',
            },
        },
        onUpdate: ({ editor: updatedEditor }) => {
            onChange?.(JSON.stringify(updatedEditor.getJSON()))
        },
    })
    const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null)
    const imageTriggerRef = useRef<HTMLImageElement | null>(null)

    useEffect(() => {
        if (!editor || editable || !notes || !noteFieldId) return
        const select = () => {
            const selection = window.getSelection()
            if (!selection || selection.isCollapsed) return
            if (!editor.view.dom.contains(selection.anchorNode) && !editor.view.dom.contains(selection.focusNode)) return
            if (!selectionIsWithinField(editor.view.dom, selection)) { notes.rejectSelection(); return }
            const anchor = editor.view.posAtDOM(selection.anchorNode!, selection.anchorOffset)
            const focus = editor.view.posAtDOM(selection.focusNode!, selection.focusOffset)
            const from = Math.min(anchor, focus), to = Math.max(anchor, focus)
            if (from === to) return
            const map = lessonTextMap(editor.state.doc)
            const range = selectedNoteRange(map, from, to)
            if (range) notes.select(noteFieldId, map.text, range.start, range.end)
        }
        const domSelect = () => {
            const selection = window.getSelection()
            if (selection?.anchorNode && editor.view.dom.contains(selection.anchorNode)) select()
        }
        editor.on('selectionUpdate', select)
        document.addEventListener('selectionchange', domSelect)
        return () => { editor.off('selectionUpdate', select); document.removeEventListener('selectionchange', domSelect) }
    }, [editor, editable, notes?.select, notes?.rejectSelection, noteFieldId])

    useEffect(() => {
        if (!editor || editable || !notes || !noteFieldId) return
        let current = true
        const map = lessonTextMap(editor.state.doc)
        void Promise.all(notes.notes.filter((note) => note.anchor.fieldId === noteFieldId).map(async (note) => ({ noteId: note.noteId, range: await resolveLessonNoteAnchor(map.text, note.anchor) }))).then((rows) => {
            if (!current || editor.isDestroyed) return
            const ranges = rows.flatMap(({ noteId, range }) => range && map.units[range.start] && map.units[range.end - 1] ? [{ noteId, from: map.units[range.start].from, to: map.units[range.end - 1].to }] : [])
            editor.view.dispatch(editor.state.tr.setMeta(lessonNotesKey, ranges))
            notes.report(noteFieldId, ranges.map((range) => range.noteId))
        })
        return () => { current = false }
    }, [editor, editable, notes?.notes, notes?.report, noteFieldId, content])

    const openImage = (image: HTMLImageElement) => {
        if (editable || !image.currentSrc && !image.src) return
        imageTriggerRef.current = image
        setZoomedImage({ src: image.currentSrc || image.src, alt: image.alt })
    }

    useEffect(() => {
        editor?.setEditable(editable)
    }, [editor, editable])

    useEffect(() => {
        if (!editor || editor.isDestroyed) return
        const next = parseLessonDocument(content)
        // A reused editor (for example after deleting a progression row) must
        // show its new field's content. Avoid resetting the cursor on typing.
        if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next)) {
            editor.commands.setContent(next, { emitUpdate: false })
        }
    }, [editor, content])

    if (!editor) {
        return <div className="rich-text-content" aria-hidden="true" />
    }

    return (
        <div className={`rich-text-editor ${editable ? 'is-editable' : 'is-readonly'}${compact ? ' rich-text-editor-compact' : ''}`} onClick={(event) => {
            const target = event.target
            if (target instanceof Element) {
                const noteId = target.closest('[data-private-note]')?.getAttribute('data-private-note')
                if (noteId && window.getSelection()?.isCollapsed) notes?.open(noteId)
            }
            if (target instanceof HTMLImageElement && target.dataset.lessonImageTrigger === 'true') openImage(target)
        }} onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLImageElement && event.target.dataset.lessonImageTrigger === 'true') {
                event.preventDefault()
                openImage(event.target)
            }
        }}>
            {editable && <RichTextToolbar editor={editor} mode={toolbarMode} lessonId={lessonId} getAccessToken={getAccessToken} apiBaseUrl={mediaApiBaseUrl} onUploadStateChange={onUploadStateChange} />}
            <EditorContent editor={editor} className="rich-text-content" data-note-field={!editable && notes ? noteFieldId : undefined} />
            {zoomedImage && <LessonImageLightbox src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} triggerRef={imageTriggerRef} />}
        </div>
    )
}
