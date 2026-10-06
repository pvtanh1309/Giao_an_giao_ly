'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect } from 'react'
import { useRef, useState } from 'react'
import { lessonEditorExtensions, parseLessonDocument } from './rich-text-extensions'
import { RichTextToolbar } from './rich-text-toolbar'
import { LessonImageLightbox } from './lesson-image-lightbox'

type LessonRichTextEditorProps = {
    content: string
    editable?: boolean
    ariaLabel?: string
    toolbarMode?: 'lesson' | 'program-schedule' | 'reference'
    compact?: boolean
    lessonId?: string
    getAccessToken?: () => Promise<string>
    mediaApiBaseUrl?: string
    onChange?: (content: string) => void
}

export function LessonRichTextEditor({
    content,
    editable = true,
    ariaLabel,
    toolbarMode = 'lesson',
    compact = false,
    lessonId,
    getAccessToken,
    mediaApiBaseUrl = process.env.NEXT_PUBLIC_CONTENT_API_URL ?? '',
    onChange,
}: LessonRichTextEditorProps) {
    const editor = useEditor({
        extensions: lessonEditorExtensions,
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

    const openImage = (image: HTMLImageElement) => {
        if (editable || !image.currentSrc && !image.src) return
        imageTriggerRef.current = image
        setZoomedImage({ src: image.currentSrc || image.src, alt: image.alt })
    }

    useEffect(() => {
        editor?.setEditable(editable)
    }, [editor, editable])

    if (!editor) {
        return <div className="rich-text-content" aria-hidden="true" />
    }

    return (
        <div className={`rich-text-editor ${editable ? 'is-editable' : 'is-readonly'}${compact ? ' rich-text-editor-compact' : ''}`} onClick={(event) => {
            const target = event.target
            if (target instanceof HTMLImageElement && target.dataset.lessonImageTrigger === 'true') openImage(target)
        }} onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLImageElement && event.target.dataset.lessonImageTrigger === 'true') {
                event.preventDefault()
                openImage(event.target)
            }
        }}>
            {editable && <RichTextToolbar editor={editor} mode={toolbarMode} lessonId={lessonId} getAccessToken={getAccessToken} apiBaseUrl={mediaApiBaseUrl} />}
            <EditorContent editor={editor} className="rich-text-content" />
            {zoomedImage && <LessonImageLightbox src={zoomedImage.src} alt={zoomedImage.alt} onClose={() => setZoomedImage(null)} triggerRef={imageTriggerRef} />}
        </div>
    )
}
