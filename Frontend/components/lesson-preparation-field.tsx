'use client'

import { useState, type ComponentProps } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { LessonRichTextEditor } from './lesson-rich-text-editor'

type Props = Omit<ComponentProps<typeof LessonRichTextEditor>, 'ariaLabel'>

function hasContent(value: string): boolean {
    if (!value.trim()) return false
    try {
        const document: unknown = JSON.parse(value)
        const populated = (node: unknown): boolean => {
            if (!node || typeof node !== 'object') return false
            const item = node as { type?: string; text?: string; content?: unknown[] }
            return Boolean(item.text?.trim()) || item.type === 'image' || item.type === 'horizontalRule'
                || (Array.isArray(item.content) && item.content.some(populated))
        }
        return populated(document)
    } catch {
        return true
    }
}

export function LessonPreparationField({ content, editable = true, onChange, onUploadStateChange, ...props }: Props) {
    const [added, setAdded] = useState(() => editable && hasContent(content))
    const [uploading, setUploading] = useState(false)
    if (!hasContent(content) && !added) {
        return editable ? <button type="button" className="outline-button" onClick={() => setAdded(true)}><Plus size={15} /> Thêm mục Chuẩn bị</button> : null
    }
    return <section className="lesson-reading-field">
        <div className="lesson-optional-field-heading">
            <h3>Chuẩn bị</h3>
            {editable && <button type="button" className="outline-button" disabled={uploading} onClick={() => { onChange?.(''); setAdded(false) }}><Trash2 size={15} /> Bỏ mục Chuẩn bị</button>}
        </div>
        <LessonRichTextEditor {...props} ariaLabel="Chuẩn bị" content={content} editable={editable} onChange={onChange} onUploadStateChange={(pending) => { setUploading(pending); onUploadStateChange?.(pending) }} />
    </section>
}
