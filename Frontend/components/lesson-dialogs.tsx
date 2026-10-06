'use client'

import { ArrowRight, BookOpen, X } from 'lucide-react'
import type { Industry, Lesson } from '../lib/content-data'

type LessonBrowser = Pick<Industry, 'level' | 'subtitle'>

type LessonDialogsProps = {
    browser: LessonBrowser | null
    lessons: Lesson[]
    onCloseBrowser: () => void
    onSelectLesson: (lesson: Lesson) => void
}

export function LessonDialogs({ browser, lessons, onCloseBrowser, onSelectLesson }: LessonDialogsProps) {
    if (!browser) return null
    return (
        <div className="modal-backdrop" onClick={onCloseBrowser}>
            <div className="content-modal lesson-library-modal" onClick={(event) => event.stopPropagation()}>
                <button className="modal-close" onClick={onCloseBrowser} aria-label="Đóng thư viện"><X size={18} /></button>
                <div className="content-modal-icon lesson"><BookOpen size={23} /></div>
                <span className="section-kicker">Thư viện bài học · {browser.level}</span>
                <h2>Các bài giáo án</h2>
                <p>Danh sách giáo án thuộc ngành {browser.level}.</p>
                <div className="lesson-list">
                    {lessons.map((lesson) => <div className="lesson-list-item" key={lesson.id}>
                        <button className="lesson-list-card" onClick={() => onSelectLesson(lesson)}>
                            <span className="lesson-list-number">{lesson.tag}</span>
                            <span className="lesson-list-copy"><strong>{lesson.title}</strong><small>{lesson.excerpt}</small></span>
                            <span className="lesson-list-time">{lesson.time}<ArrowRight size={16} /></span>
                        </button>
                    </div>)}
                </div>
                {!lessons.length && <p>Chưa có giáo án trong ngành này.</p>}
            </div>
        </div>
    )
}
