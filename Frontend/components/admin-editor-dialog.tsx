'use client'

import { ArrowRight, X } from 'lucide-react'
import { defaultProgramScheduleColumns, lessonPlans, type Catechist, type Industry, type ProgramScheduleColumn, type ProgramScheduleRow } from '../lib/content-data'
import { CatechistEditorFields } from './catechist-editor-fields'
import { LessonEditorFields } from './lesson-editor-fields'
import { ProgramScheduleEditor } from './program-schedule-editor'
import type { LessonStructuredContent } from '../lib/lesson-content'

export type AdminEditorType = 'lesson' | 'program' | 'catechist'

type EditingContent = {
    title: string
    description: string
    content: string
}

type AdminEditorDialogProps = {
    editor: AdminEditorType | null
    editingLabel: string | null
    catechist: Catechist
    content: EditingContent
    level: string
    sublevel: string
    industry?: Industry
    schedule: ProgramScheduleRow[]
    scheduleColumns: ProgramScheduleColumn[]
    lessonTag: string
    lessonTime: string
    lessonFields: LessonStructuredContent
    lessonId?: string
    getAccessToken?: () => Promise<string>
    onTitleChange: (value: string) => void
    onCatechistChange: (value: Catechist) => void
    onContentChange: (value: EditingContent) => void
    onLevelChange: (level: string) => void
    onSublevelChange: (sublevel: string) => void
    onScheduleChange: (schedule: ProgramScheduleRow[]) => void
    onScheduleColumnsChange: (columns: ProgramScheduleColumn[]) => void
    onLessonTagChange: (tag: string) => void
    onLessonTimeChange: (time: string) => void
    onLessonFieldsChange: (fields: LessonStructuredContent) => void
    onClose: () => void
    onDelete: () => void
    onSave: () => void
}

export function AdminEditorDialog({
    editor,
    editingLabel,
    catechist,
    content,
    level,
    sublevel,
    industry,
    schedule,
    scheduleColumns = defaultProgramScheduleColumns,
    lessonTag,
    lessonTime,
    lessonFields,
    lessonId,
    getAccessToken,
    onTitleChange,
    onCatechistChange,
    onContentChange,
    onLevelChange,
    onSublevelChange,
    onScheduleChange,
    onScheduleColumnsChange,
    onLessonTagChange,
    onLessonTimeChange,
    onLessonFieldsChange,
    onClose,
    onDelete,
    onSave,
}: AdminEditorDialogProps) {
    if (!editor) return null

    const title = editor === 'catechist'
        ? 'giáo lý viên'
        : editor === 'lesson'
            ? 'bài giáo án'
            : 'chương trình học'

    return (
        <div className="modal-backdrop admin-editor-backdrop" onClick={onClose}>
            <div className={`content-modal admin-editor-modal ${editor === 'lesson' ? 'admin-editor-modal-lesson' : ''}`} onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Đóng biểu mẫu">
                    <X size={18} />
                </button>
                <span className="section-kicker">
                    CMS quản trị · {editor === 'lesson' ? 'Giáo án' : editor === 'program' ? 'Chương trình học' : 'Giáo lý viên'}
                </span>
                <h2>{editingLabel ? `Sửa ${title}` : `Thêm ${title}`}</h2>
                <p>
                    {editor === 'catechist'
                        ? 'Cập nhật thông tin đội ngũ phục vụ. Dữ liệu hiện chỉ lưu trong phiên frontend.'
                        : 'Nhập nội dung mẫu để cập nhật thư viện. Dữ liệu hiện chỉ lưu trong phiên frontend.'}
                </p>
                <label>
                    {editor === 'catechist' ? 'Tên Thánh, Họ và tên' : 'Tên nội dung'}
                    <input
                        required={editor === 'catechist'}
                        value={editor === 'catechist' ? catechist.name : content.title}
                        onChange={(event) =>
                            editor === 'catechist'
                                ? onCatechistChange({ ...catechist, name: event.target.value })
                                : onTitleChange(event.target.value)
                        }
                        placeholder={editor === 'lesson' ? 'Ví dụ: Chúa Giêsu yêu thương em' : editor === 'program' ? 'Ví dụ: Hành trình đức tin Ấu Nhi' : 'Ví dụ: Maria Nguyễn Thị Lan'}
                    />
                </label>
                {editor !== 'catechist' && (
                    <label>
                        Ngành học
                        <select
                            value={level}
                            onChange={(event) => onLevelChange(event.target.value)}
                        >
                            {lessonPlans.map((plan) => <option key={plan.level} value={plan.level}>{plan.level}</option>)}
                        </select>
                    </label>
                )}
                {editor === 'program' && industry?.sublevels.length ? (
                    <label>
                        Phân ngành
                        <select value={sublevel} onChange={(event) => onSublevelChange(event.target.value)}>
                            {industry.sublevels.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </label>
                ) : null}
                {editor === 'lesson' && (
                    <LessonEditorFields
                        description={content.description}
                        tag={lessonTag}
                        time={lessonTime}
                        fields={lessonFields}
                        lessonId={lessonId}
                        getAccessToken={getAccessToken}
                        onDescriptionChange={(description) => onContentChange({ ...content, description })}
                        onTagChange={onLessonTagChange}
                        onTimeChange={onLessonTimeChange}
                        onFieldsChange={onLessonFieldsChange}
                    />
                )}
                {editor === 'catechist' && (
                    <CatechistEditorFields catechist={catechist} onChange={onCatechistChange} />
                )}
                {editor === 'program' && (
                    <>
                        <label>
                            Mô tả chương trình học
                            <textarea
                                value={content.description}
                                onChange={(event) => onContentChange({ ...content, description: event.target.value })}
                                placeholder="Mô tả ngắn để hiển thị trong chương trình học"
                                rows={3}
                            />
                        </label>
                        <ProgramScheduleEditor columns={scheduleColumns} rows={schedule} onColumnsChange={onScheduleColumnsChange} onChange={onScheduleChange} />
                    </>
                )}
                <div className="admin-editor-actions">
                    <button className="secondary-button" onClick={onClose}>Hủy</button>
                    {editingLabel && <button className="admin-danger-button" onClick={onDelete}>Xóa</button>}
                    <button className="primary-button" onClick={onSave}>
                        Lưu thay đổi <ArrowRight size={17} />
                    </button>
                </div>
            </div>
        </div>
    )
}
