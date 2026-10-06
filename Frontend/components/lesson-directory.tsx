'use client'

import { ArrowRight, BookOpenText, Plus, Search } from 'lucide-react'
import { industryColorHex, type Industry, type Lesson } from '../lib/content-data'
import { getLessonSearchText } from '../lib/lesson-content'

type LessonDirectoryProps = {
    canManage: boolean
    industries: Industry[]
    lessons: Lesson[]
    query: string
    onQueryChange: (query: string) => void
    onAdd: () => void
    onOpenIndustry: (industry: Industry) => void
    onOpenLesson: (lesson: Lesson) => void
    onOpenReferences: () => void
}

export function LessonDirectory({
    canManage,
    industries,
    lessons,
    query,
    onQueryChange,
    onAdd,
    onOpenIndustry,
    onOpenLesson,
    onOpenReferences,
}: LessonDirectoryProps) {
    const matchingLessons = lessons.filter((lesson) =>
        getLessonSearchText(lesson)
            .toLocaleLowerCase('vi')
            .includes(query.trim().toLocaleLowerCase('vi')),
    )

    return (
        <section id="lesson-plans" className="content-section">
            <div className="section-heading">
                <div>
                    <span className="section-kicker">Thư viện tài liệu</span>
                    <h2>Giáo án theo ngành</h2>
                    <p>Chọn ngành học để bắt đầu hành trình đồng hành cùng các em.</p>
                </div>
                <div className="section-heading-actions">
                    <label className="directory-search">
                        <Search size={17} aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Tìm giáo án"
                            placeholder="Tìm giáo án theo tên hoặc nội dung"
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                        />
                    </label>
                    {canManage && (
                        <button className="outline-button" onClick={onAdd}>
                            <Plus size={16} /> Thêm giáo án
                        </button>
                    )}
                </div>
            </div>
            {query.trim() ? (
                <div className="lesson-search-results">
                    {matchingLessons.map((lesson) => (
                        <button
                            className="lesson-search-result"
                            key={lesson.id}
                            onClick={() => onOpenLesson(lesson)}
                        >
                            <span className="lesson-list-copy">
                                <strong>{lesson.title}</strong>
                                <small>{lesson.excerpt}</small>
                            </span>
                            <span className="lesson-search-meta">
                                {lesson.level} <ArrowRight size={15} />
                            </span>
                        </button>
                    ))}
                    {!matchingLessons.length && <p>Không tìm thấy giáo án phù hợp.</p>}
                </div>
            ) : (
                <div className="lesson-grid">
                    {industries.map((industry) => (
                        <button
                            className="lesson-card"
                            style={{ backgroundColor: industryColorHex[industry.color], color: industry.color === 'pink' || industry.color === 'green-light' ? '#29351d' : 'white' }}
                            key={industry.level}
                            onClick={() => onOpenIndustry(industry)}
                        >
                            <div className="card-top">
                                <span className="card-icon">{industry.icon}</span>
                                <span className="card-arrow"><ArrowRight size={18} /></span>
                            </div>
                            <span className="card-label">NGÀNH {industry.level.toUpperCase()}</span>
                            <h3>{industry.level}</h3>
                            <p>{industry.subtitle}</p>
                            <div className="card-foot">
                                <span>{lessons.filter((lesson) => lesson.level === industry.level).length} giáo án</span>
                                <span className="view-link">Khám phá <ArrowRight size={14} /></span>
                            </div>
                        </button>
                    ))}
                    <button className="reference-library-card" onClick={onOpenReferences}>
                        <div className="card-top">
                            <span className="card-icon"><BookOpenText size={22} /></span>
                            <span className="card-arrow"><ArrowRight size={18} /></span>
                        </div>
                        <span className="card-label">THƯ VIỆN BỔ TRỢ</span>
                        <h3>Tài liệu tham khảo</h3>
                        <p>Hoạt động sinh hoạt và kỹ năng đồng hành cùng các em.</p>
                        <div className="card-foot">
                            <span>2 nhóm tài liệu</span>
                            <span className="view-link">Khám phá <ArrowRight size={14} /></span>
                        </div>
                    </button>
                </div>
            )}
        </section>
    )
}
