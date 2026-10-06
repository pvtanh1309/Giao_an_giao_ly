'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Save, Trash2, X } from 'lucide-react'
import type { Program } from '../lib/content-data'
import { defaultProgramScheduleColumns, lessonPlans, programSchedule } from '../lib/content-data'
import { ProgramScheduleCellContent } from './program-schedule-cell-content'
import { ProgramScheduleEditor } from './program-schedule-editor'
import { getProgramScheduleCellGroup, isProgramScheduleCellCovered } from '../lib/program-schedule-merges'

export type ProgramReadingPageProps = {
    program: Program
    canManage: boolean
    onSave: (program: Program) => void
    onDelete: (program: Program) => void
    onBack: () => void
}

export function ProgramReadingPage({ program, canManage, onSave, onDelete, onBack }: ProgramReadingPageProps) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(program)

    useEffect(() => {
        setDraft(program)
        setEditing(false)
    }, [program])

    const columns = (editing ? draft.scheduleColumns : program.scheduleColumns) ?? defaultProgramScheduleColumns
    const schedule = (editing ? draft.schedule : program.schedule) ?? programSchedule

    return (
        <section className="program-reading-page" aria-label="Chi tiết chương trình học">
            <div className="reading-toolbar">
                <button type="button" className="secondary-button program-back-button" onClick={onBack}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    {program.sublevel ? `Quay lại phân ngành ${program.sublevel}` : `Quay lại ngành ${program.level}`}
                </button>
                {canManage && !editing && <button className="outline-button" onClick={() => setEditing(true)}>Chỉnh sửa trực tiếp</button>}
                {canManage && editing && <div className="reading-actions">
                    <button className="secondary-button" onClick={() => { setDraft(program); setEditing(false) }}><X size={16} /> Hủy</button>
                    <button className="primary-button" onClick={() => { onSave(draft); setEditing(false) }}><Save size={16} /> Lưu thay đổi</button>
                    <button className="admin-danger-button" onClick={() => onDelete(program)}><Trash2 size={16} /> Xóa chương trình</button>
                </div>}
            </div>

            <article className="program-reading-paper">
                <header className="program-reading-header">
                    <span className="section-kicker">Lộ trình đào tạo</span>
                    {editing ? <>
                        <input aria-label="Tên chương trình" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                        <textarea aria-label="Mô tả chương trình" value={draft.desc} onChange={(event) => setDraft({ ...draft, desc: event.target.value })} rows={3} />
                        <div className="program-reading-meta-edit">
                            <select aria-label="Ngành học" value={draft.level} onChange={(event) => {
                                const nextLevel = event.target.value
                                const nextPlan = lessonPlans.find((plan) => plan.level === nextLevel)
                                setDraft({ ...draft, level: nextLevel, color: nextPlan?.color ?? lessonPlans[0].color, sublevel: nextPlan?.sublevels[0] })
                            }}>{lessonPlans.map((plan) => <option key={plan.level} value={plan.level}>{plan.level}</option>)}</select>
                            {lessonPlans.find((plan) => plan.level === draft.level)?.sublevels.length ? <select aria-label="Phân ngành" value={draft.sublevel ?? ''} onChange={(event) => setDraft({ ...draft, sublevel: event.target.value || undefined })}>
                                {lessonPlans.find((plan) => plan.level === draft.level)?.sublevels.map((sublevel) => <option key={sublevel} value={sublevel}>{sublevel}</option>)}
                            </select> : null}
                            <input aria-label="Số bài học" value={draft.lessons} onChange={(event) => setDraft({ ...draft, lessons: event.target.value })} />
                        </div>
                    </> : <>
                        <h1>{program.title}</h1>
                        <p>{program.desc}</p>
                        <div className="program-reading-meta"><span>{program.level}{program.sublevel ? ` · ${program.sublevel}` : ''}</span><span>{program.lessons}</span></div>
                    </>}
                </header>

                {editing ? <ProgramScheduleEditor columns={columns} rows={schedule} onColumnsChange={(scheduleColumns) => setDraft((current) => ({ ...current, scheduleColumns }))} onChange={(rows) => setDraft((current) => ({ ...current, schedule: rows }))} /> : (
                    <section className="program-reading-schedule">
                        <h2>Lịch học</h2>
                        <div className="schedule-table-wrap">
                            <table className="schedule-table">
                                <thead><tr>{columns.map((column) => <th data-column-id={column.id} key={column.id}>{column.label}</th>)}</tr></thead>
                                <tbody>{schedule.map((row) => <tr key={row.id}>{columns.map((column, index) => {
                                    if (isProgramScheduleCellCovered(row, column.id)) return null
                                    const group = getProgramScheduleCellGroup(row, column.id)
                                    return <td data-column-id={column.id} className={index === 2 ? 'schedule-topic' : undefined} colSpan={group?.length} key={column.id}><ProgramScheduleCellContent value={row.values[column.id] ?? ''} /></td>
                                })}</tr>)}</tbody>
                            </table>
                        </div>
                        <div className="program-schedule-cards">{schedule.map((row) => <article className="program-schedule-card" key={row.id}>
                            <dl>{columns.map((column) => {
                                if (isProgramScheduleCellCovered(row, column.id)) return null
                                const group = getProgramScheduleCellGroup(row, column.id)
                                const label = group?.map((id) => columns.find((item) => item.id === id)?.label).filter(Boolean).join(' · ') ?? column.label
                                return <div className={`program-schedule-card-field program-schedule-card-field-${column.id}`} key={column.id}>
                                <dt>{label}</dt>
                                <dd><ProgramScheduleCellContent value={row.values[column.id] || '—'} /></dd>
                            </div>})}</dl>
                        </article>)}</div>
                        {!schedule.length && <p className="reading-empty">Chưa có lịch học.</p>}
                    </section>
                )}
            </article>
        </section>
    )
}
