'use client'

import { FileText, Plus, Trash2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { industryColorHex, type Industry, type Program } from '../lib/content-data'
import { getProgramsForDirectIndustry, getProgramsForIndustry, getProgramsForSublevel } from '../lib/program-navigation'

type ProgramDirectoryProps = {
    canManage: boolean
    industries: Industry[]
    programs: Program[]
    loading?: boolean
    loadError?: string
    onRetry?: () => void
    selectedLevel: string | null
    selectedSublevel: string | null
    onSelectLevel: (level: string) => void
    onSelectSublevel: (sublevel: string) => void
    onBack: (target: 'industries' | 'sublevels') => void
    onAdd: (level?: string, sublevel?: string) => void
    onOpen: (program: Program) => void
    onDelete: (program: Program) => void
}

export function ProgramDirectory({
    canManage,
    industries,
    programs,
    loading = false,
    loadError = '',
    onRetry,
    selectedLevel,
    selectedSublevel,
    onSelectLevel,
    onSelectSublevel,
    onBack,
    onAdd,
    onOpen,
    onDelete,
}: ProgramDirectoryProps) {
    const selectedIndustry = industries.find((industry) => industry.level === selectedLevel)
    const viewingPrograms = Boolean(selectedIndustry && (!selectedIndustry.sublevels.length || selectedSublevel))
    const visiblePrograms = selectedIndustry
        ? selectedSublevel
            ? getProgramsForSublevel(programs, selectedIndustry.level, selectedSublevel)
            : selectedIndustry.sublevels.length
                ? []
                : getProgramsForDirectIndustry(programs, selectedIndustry.level)
        : []
    const stageAccent = selectedIndustry ? industryColorHex[selectedIndustry.color] : undefined

    const renderProgram = (program: Program) => (
        <article
            className="program-row"
            key={program.id}
            onClick={() => onOpen(program)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpen(program)
            }}
        >
            <div className="program-badge" style={{ backgroundColor: industryColorHex[program.color], color: program.color === 'pink' || program.color === 'green-light' ? '#29351d' : 'white' }}><FileText size={19} /></div>
            <div className="program-info">
                <h3>{program.title}</h3>
                <p>{program.level}{program.sublevel ? ` · ${program.sublevel}` : ''} · {program.desc}</p>
                <span className="program-lessons">{program.lessons}</span>
            </div>
            {canManage && (
                <span className="admin-card-actions">
                    <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(program) }}>
                        <Trash2 size={14} /> Xóa
                    </button>
                </span>
            )}
        </article>
    )

    return (
        <section id="programs" className="program-section">
            <header className="program-hero">
                <div className="program-hero-inner">
                    <div className="section-heading light program-heading">
                        <div>
                            <span className="section-kicker">Lộ trình đào tạo</span>
                            <h2>Chương trình học</h2>
                            <p>Hành trình đức tin được xây dựng phù hợp với từng giai đoạn trưởng thành.</p>
                        </div>
                        {canManage ? (
                            <button type="button" className="outline-button light-button" onClick={() => onAdd(selectedLevel ?? undefined, selectedSublevel ?? undefined)}>
                                <Plus size={16} /> Thêm chương trình
                            </button>
                        ) : (
                            <button type="button" className="outline-button light-button" onClick={() => onBack('industries')}>
                                Xem toàn bộ
                            </button>
                        )}
                    </div>
                </div>
            </header>
            <div className="program-inner" aria-busy={loading}>
                {loadError && <div className="directory-load-error program-load-error" role="alert"><p>{loadError}</p><button type="button" className="outline-button light-button" onClick={onRetry}>Thử tải lại</button></div>}
                {selectedIndustry && (
                    <nav className="program-breadcrumb" aria-label="Điều hướng chương trình học">
                        <button type="button" onClick={() => onBack('industries')}>Tất cả ngành</button>
                        <span aria-hidden="true">/</span>
                        <button type="button" disabled={!selectedSublevel && viewingPrograms} onClick={() => onBack('sublevels')}>
                            {selectedIndustry.level}
                        </button>
                        {selectedSublevel && <><span aria-hidden="true">/</span><span aria-current="page">{selectedSublevel}</span></>}
                    </nav>
                )}
                <div className={`program-list ${!selectedIndustry ? 'program-stage-list' : !viewingPrograms ? 'program-sublevel-list' : 'program-content-list'}`}>
                    {!selectedIndustry && industries.map((industry, index) => {
                        const programCount = getProgramsForIndustry(programs, industry.level).length
                        const step = String(index + 1).padStart(2, '0')
                        return (
                            <button
                                type="button"
                                className="program-category-card"
                                style={{ '--stage-color': industryColorHex[industry.color] } as CSSProperties}
                                key={industry.level}
                                onClick={() => onSelectLevel(industry.level)}
                            >
                                <span className="program-step-number" aria-hidden="true">{step}</span>
                                <span className="program-category-icon" aria-hidden="true">{industry.icon}</span>
                                <span className="program-category-copy">
                                    <strong>{industry.level}</strong>
                                <small>{industry.sublevels.length ? `${industry.sublevels.length} phân ngành` : loading ? <span className="session-skeleton program-count-skeleton" aria-hidden="true" /> : loadError ? '— chương trình học' : `${programCount} chương trình học`}</small>
                                </span>
                            </button>
                        )
                    })}
                    {selectedIndustry && !viewingPrograms && selectedIndustry.sublevels.map((sublevel) => {
                        const programCount = getProgramsForSublevel(programs, selectedIndustry.level, sublevel).length
                        return <button type="button" className="program-sublevel-row" style={{ '--stage-color': stageAccent } as CSSProperties} key={sublevel} onClick={() => onSelectSublevel(sublevel)}>
                            <span><strong>{sublevel}</strong><small>{loading ? <span className="session-skeleton program-count-skeleton" aria-hidden="true" /> : loadError ? '— chương trình học' : `${programCount} chương trình học`}</small></span>
                        </button>
                    })}
                    {selectedIndustry && viewingPrograms && loading && Array.from({ length: 4 }, (_, index) => <div className="program-row program-row-skeleton" aria-hidden="true" key={`loading-${index}`}><span className="session-skeleton session-skeleton-icon" /><span className="program-row-skeleton-copy"><span className="session-skeleton session-skeleton-line" /><span className="session-skeleton session-skeleton-line short" /></span></div>)}
                    {selectedIndustry && viewingPrograms && visiblePrograms.map(renderProgram)}
                    {selectedIndustry && viewingPrograms && !loading && !loadError && !visiblePrograms.length && <p className="program-empty">Chưa có chương trình học cho {selectedSublevel ?? selectedIndustry.level}.</p>}
                </div>
            </div>
        </section>
    )
}
