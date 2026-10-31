'use client'

import { BookOpenText, Plus, Search } from 'lucide-react'
import { industryColorHex, type Industry, type Lesson } from '../lib/content-data'
import { getLessonSearchText, sortLessonsByNumber } from '../lib/lesson-content'

type LessonDirectoryProps = {
    canManage: boolean
    industries: Industry[]
    lessons: Lesson[]
    loading?: boolean
    loadError?: string
    onRetry?: () => void
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
    loading = false,
    loadError = '',
    onRetry,
    query,
    onQueryChange,
    onAdd,
    onOpenIndustry,
    onOpenLesson,
    onOpenReferences,
}: LessonDirectoryProps) {
    const matchingLessons = sortLessonsByNumber(lessons.filter((lesson) =>
        getLessonSearchText(lesson)
            .toLocaleLowerCase('vi')
            .includes(query.trim().toLocaleLowerCase('vi')),
    ))

    return (
        <section id="lesson-plans" className="content-section">
            <div className="section-heading">
                <div>
                    <span className="section-kicker">Thư viện giáo án</span>
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
                            disabled={loading}
                            onChange={(event) => onQueryChange(event.target.value)}
                        />
                    </label>
                    {canManage && (
                        <button className="outline-button" disabled={loading} onClick={onAdd}>
                            <Plus size={16} /> Thêm giáo án
                        </button>
                    )}
                </div>
            </div>
            {query.trim() ? (
                <div className="lesson-search-results">
                    {loading && Array.from({ length: 4 }, (_, index) => <div className="lesson-search-result lesson-search-result-skeleton" aria-hidden="true" key={`loading-${index}`} />)}
                    {loadError && <div className="directory-load-error" role="alert"><p>{loadError}</p><button type="button" className="outline-button" onClick={onRetry}>Thử tải lại</button></div>}
                    {!loading && !loadError && matchingLessons.map((lesson) => (
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
                                {lesson.level}
                            </span>
                        </button>
                    ))}
                    {!loading && !loadError && !matchingLessons.length && <p>Không tìm thấy giáo án phù hợp.</p>}
                </div>
            ) : (
                <>
                {loadError && <div className="directory-load-error" role="alert"><p>{loadError}</p><button type="button" className="outline-button" onClick={onRetry}>Thử tải lại</button></div>}
                <div className="lesson-grid" aria-busy={loading}>
                    {industries.map((industry) => (
                        <button
                            className="lesson-card"
                            disabled={loading || Boolean(loadError)}
                            style={{ backgroundColor: industryColorHex[industry.color], color: industry.color === 'pink' || industry.color === 'green-light' ? '#29351d' : 'white' }}
                            key={industry.level}
                            onClick={() => onOpenIndustry(industry)}
                        >
                            <div className="card-top">
                                <span className="card-icon">{industry.icon}</span>
                            </div>
                            <span className="card-label">NGÀNH {industry.level.toUpperCase()}</span>
                            <h3>{industry.level}</h3>
                            <p>{industry.subtitle}</p>
                            <div className="card-foot">
                                <span>{loading ? <span className="session-skeleton lesson-count-skeleton" aria-hidden="true" /> : loadError ? '— giáo án' : `${lessons.filter((lesson) => lesson.level === industry.level).length} giáo án`}</span>
                                <span>Khám phá</span>
                            </div>
                        </button>
                    ))}
                    <button className="reference-library-card" onClick={onOpenReferences}>
                        <div className="card-top">
                            <span className="card-icon"><BookOpenText size={22} /></span>
                        </div>
                        <span className="card-label">THƯ VIỆN BỔ TRỢ</span>
                        <h3>Tài liệu tham khảo</h3>
                        <p>Hoạt động sinh hoạt và kỹ năng đồng hành cùng các em.</p>
                        <div className="card-foot">
                            <span>2 nhóm tài liệu</span>
                            <span>Khám phá</span>
                        </div>
                    </button>
                </div>
                </>
            )}
        </section>
    )
}
