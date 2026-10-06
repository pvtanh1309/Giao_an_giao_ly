'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Check, Heart, Pencil, Users, X } from 'lucide-react'

const ACADEMIC_YEAR_STORAGE_KEY = 'giao-ly-academic-year'
const DEFAULT_ACADEMIC_YEAR = '2026–2027'

type StatsStripProps = {
    lessonCount: number
    industryCount: number
    canManage: boolean
}

export function StatsStrip({ lessonCount, industryCount, canManage }: StatsStripProps) {
    const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR)
    const [yearDraft, setYearDraft] = useState(DEFAULT_ACADEMIC_YEAR)
    const [editingYear, setEditingYear] = useState(false)

    useEffect(() => {
        const savedYear = window.localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY)
        if (savedYear?.trim()) {
            setAcademicYear(savedYear)
            setYearDraft(savedYear)
        }
    }, [])

    const saveAcademicYear = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const value = yearDraft.trim()
        if (!value) return
        setAcademicYear(value)
        window.localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, value)
        setEditingYear(false)
    }

    const cancelYearEdit = () => {
        setYearDraft(academicYear)
        setEditingYear(false)
    }

    return (
        <section className="stats-strip" aria-label="Thống kê kho giáo lý">
            <div className="stat"><BookOpen size={19} /><span><b>{lessonCount}</b> giáo án</span></div>
            <div className="stat"><Users size={19} /><span><b>{industryCount}</b> ngành có giáo án</span></div>
            <div className="stat stat-academic-year">
                <CalendarDays size={19} />
                {editingYear ? <form className="academic-year-form" onSubmit={saveAcademicYear}>
                    <label htmlFor="academic-year-input">Năm học</label>
                    <input id="academic-year-input" value={yearDraft} onChange={(event) => setYearDraft(event.target.value)} aria-label="Năm học hiển thị" autoFocus />
                    <button type="submit" aria-label="Lưu năm học" title="Lưu"><Check size={15} /></button>
                    <button type="button" aria-label="Hủy sửa năm học" title="Hủy" onClick={cancelYearEdit}><X size={15} /></button>
                </form> : <>
                    <span>Năm học <b>{academicYear}</b></span>
                    {canManage && <button type="button" className="academic-year-edit" aria-label="Chỉnh sửa năm học" title="Chỉnh sửa năm học" onClick={() => { setYearDraft(academicYear); setEditingYear(true) }}><Pencil size={14} /></button>}
                </>}
            </div>
            <div className="stat stat-quote"><Heart size={17} fill="currentColor" /><span>Phục vụ sứ mạng loan báo Tin Mừng</span></div>
        </section>
    )
}
