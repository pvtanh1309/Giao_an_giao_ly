'use client'

import { Save, X } from 'lucide-react'
import { useState } from 'react'
import { LessonRichTextEditor } from './lesson-rich-text-editor'

type ProgramScheduleFormatDialogProps = {
    value: string
    ariaLabel: string
    onSave: (value: string) => void
    onCancel: () => void
}

export function ProgramScheduleFormatDialog({ value, ariaLabel, onSave, onCancel }: ProgramScheduleFormatDialogProps) {
    const [draft, setDraft] = useState(value)

    return <div className="schedule-column-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}>
        <section className="schedule-column-dialog schedule-format-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-format-title">
            <button type="button" className="schedule-column-dialog-close" onClick={onCancel} aria-label="Đóng"><X size={18} /></button>
            <span className="section-kicker">Định dạng nội dung</span>
            <h2 id="schedule-format-title">Chỉnh sửa đoạn chữ</h2>
            <p>Bôi đen một phần nội dung để đổi màu hoặc cỡ chữ. Căn lề áp dụng cho đoạn văn hiện tại.</p>
            <LessonRichTextEditor
                content={draft}
                ariaLabel={ariaLabel}
                toolbarMode="program-schedule"
                compact
                onChange={setDraft}
            />
            <div className="schedule-column-dialog-actions">
                <button type="button" className="secondary-button" onClick={onCancel}>Hủy</button>
                <button type="button" className="primary-button" onClick={() => onSave(draft)}><Save size={16} /> Áp dụng</button>
            </div>
        </section>
    </div>
}
