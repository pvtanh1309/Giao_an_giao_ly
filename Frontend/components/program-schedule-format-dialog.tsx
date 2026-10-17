'use client'

import { Save, X } from 'lucide-react'
import { useState } from 'react'
import { LessonRichTextEditor } from './lesson-rich-text-editor'

type ProgramScheduleFormatDialogProps = {
    value: string
    backgroundColor?: string
    ariaLabel: string
    onSave: (value: string, backgroundColor?: string) => void
    onCancel: () => void
}

export function ProgramScheduleFormatDialog({ value, backgroundColor, ariaLabel, onSave, onCancel }: ProgramScheduleFormatDialogProps) {
    const [draft, setDraft] = useState(value)
    const [draftBackground, setDraftBackground] = useState(backgroundColor)

    return <div className="schedule-column-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}>
        <section className="schedule-column-dialog schedule-format-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-format-title">
            <button type="button" className="schedule-column-dialog-close" onClick={onCancel} aria-label="Đóng"><X size={18} /></button>
            <span className="section-kicker">Định dạng nội dung</span>
            <h2 id="schedule-format-title">Chỉnh sửa đoạn chữ</h2>
            <p>Bôi đen một phần nội dung để đổi màu hoặc cỡ chữ. Căn lề áp dụng cho đoạn văn hiện tại.</p>
            <div className="schedule-cell-background-controls">
                <label><input type="checkbox" checked={Boolean(draftBackground)} onChange={(event) => setDraftBackground(event.target.checked ? '#fff2cc' : undefined)} /> Tô màu nền ô</label>
                <input type="color" aria-label="Màu nền ô" disabled={!draftBackground} value={draftBackground ?? '#fff2cc'} onChange={(event) => setDraftBackground(event.target.value)} />
            </div>
            <div className="schedule-cell-background-preview" style={{ backgroundColor: draftBackground }}>
                Xem trước màu nền ô
            </div>
            <LessonRichTextEditor
                content={draft}
                ariaLabel={ariaLabel}
                toolbarMode="program-schedule"
                compact
                onChange={setDraft}
            />
            <div className="schedule-column-dialog-actions">
                <button type="button" className="secondary-button" onClick={onCancel}>Hủy</button>
                <button type="button" className="primary-button" onClick={() => onSave(draft, draftBackground)}><Save size={16} /> Áp dụng</button>
            </div>
        </section>
    </div>
}
