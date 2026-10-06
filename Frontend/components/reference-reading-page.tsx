'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, RotateCcw, Save, Trash2, X } from 'lucide-react'
import type { ReferenceCategory, ReferenceDocument } from '../lib/reference-content'
import { LessonRichTextEditor } from './lesson-rich-text-editor'

type ReferenceReadingPageProps = {
    reference: ReferenceDocument
    canManage: boolean
    onBack: () => void
    onSaveDraft: (reference: ReferenceDocument) => void
    onPublish: (reference: ReferenceDocument) => void
    onDelete: (reference: ReferenceDocument) => void
    onRestore: (reference: ReferenceDocument) => void
}

const emptyDocument = '{"type":"doc","content":[{"type":"paragraph"}]}'

export function ReferenceReadingPage({ reference, canManage, onBack, onSaveDraft, onPublish, onDelete, onRestore }: ReferenceReadingPageProps) {
    const [editing, setEditing] = useState(canManage && !reference.published)
    const [title, setTitle] = useState(reference.title)
    const [category, setCategory] = useState<ReferenceCategory>(reference.category)
    const [content, setContent] = useState(reference.draft?.content ?? reference.published?.content ?? emptyDocument)
    const [validationError, setValidationError] = useState('')

    useEffect(() => {
        setTitle(reference.title)
        setCategory(reference.category)
        setContent(reference.draft?.content ?? reference.published?.content ?? emptyDocument)
        setValidationError('')
        setEditing(canManage && !reference.published)
    }, [reference, canManage])

    const updatedReference = (): ReferenceDocument => ({
        ...reference,
        title: title.trim(),
        category,
        draft: { content, version: (reference.draft?.version ?? reference.published?.version ?? 0) + 1 },
    })

    const shownContent = canManage
        ? reference.draft?.content ?? reference.published?.content ?? emptyDocument
        : reference.published?.content ?? emptyDocument

    return (
        <section className="reference-reading-page" aria-label="Chi tiết tài liệu tham khảo">
            <div className="reading-toolbar">
                <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> Danh sách tài liệu</button>
                {canManage && reference.status === 'ACTIVE' && !editing && <button className="outline-button" onClick={() => setEditing(true)}>Chỉnh sửa trực tiếp</button>}
                {canManage && editing && <div className="reading-actions">
                    <button className="secondary-button" onClick={() => { setTitle(reference.title); setCategory(reference.category); setContent(reference.draft?.content ?? reference.published?.content ?? emptyDocument); setEditing(false) }}><X size={16} /> Hủy</button>
                    <button className="secondary-button" onClick={() => {
                        if (!title.trim()) { setValidationError('Vui lòng nhập tiêu đề trước khi lưu.'); return }
                        setValidationError('')
                        onSaveDraft(updatedReference())
                    }}><Save size={16} /> Lưu nháp</button>
                    <button className="primary-button" onClick={() => {
                        if (!title.trim()) { setValidationError('Vui lòng nhập tiêu đề trước khi xuất bản.'); return }
                        setValidationError('')
                        onPublish(updatedReference())
                        setEditing(false)
                    }}><Save size={16} /> Xuất bản</button>
                    {reference.status === 'ACTIVE' && reference.id && (reference.draft || reference.published) && <button className="admin-danger-button" onClick={() => onDelete(reference)}><Trash2 size={16} /> Xóa tài liệu</button>}
                </div>}
                {canManage && reference.status === 'DELETED' && <button className="primary-button" onClick={() => onRestore(reference)}><RotateCcw size={16} /> Khôi phục</button>}
            </div>

            <article className="reference-reading-paper">
                <header className="reference-reading-header">
                    <span className="section-kicker">Tài liệu tham khảo · {editing ? category : reference.category}</span>
                    {editing ? <>
                        <input aria-label="Tiêu đề tài liệu" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tiêu đề tài liệu" />
                        <select aria-label="Nhóm tài liệu" value={category} onChange={(event) => setCategory(event.target.value as ReferenceCategory)}>
                            <option value="Sinh hoạt">Sinh hoạt</option>
                            <option value="Kỹ năng">Kỹ năng</option>
                        </select>
                    </> : <><h1>{reference.title}</h1><p>{reference.category}</p></>}
                    {reference.draft && reference.published && <span className="reference-draft-notice">Đang có thay đổi ở bản nháp</span>}
                    {reference.status === 'DELETED' && <span className="reference-deleted-notice">Đã xóa · có thể khôi phục trong 10 ngày</span>}
                    {validationError && <span className="reference-validation-error" role="alert">{validationError}</span>}
                </header>
                <div className="reference-reading-content">
                    <LessonRichTextEditor
                        key={`${reference.id}-${editing ? 'edit' : 'view'}-${reference.draft?.version ?? reference.published?.version ?? 0}`}
                        ariaLabel="Nội dung tài liệu tham khảo"
                        toolbarMode="reference"
                        content={editing ? content : shownContent}
                        editable={editing}
                        onChange={setContent}
                    />
                </div>
            </article>
        </section>
    )
}
