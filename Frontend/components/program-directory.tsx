'use client'

import { ArrowRight, FileText, Plus, Trash2 } from 'lucide-react'
import { industryColorHex, type Industry, type Program } from '../lib/content-data'
import { getProgramsForDirectIndustry, getProgramsForIndustry, getProgramsForSublevel } from '../lib/program-navigation'

type ProgramDirectoryProps = {
    canManage: boolean
    industries: Industry[]
    programs: Program[]
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
            <button className="round-arrow" aria-label={`Xem ${program.title}`}><ArrowRight size={17} /></button>
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
            <div className="program-inner">
                <div className="section-heading light">
                    <div>
                        <span className="section-kicker">Lộ trình đào tạo</span>
                        <h2>Chương trình học</h2>
                        <p>Hành trình đức tin được xây dựng phù hợp với từng giai đoạn trưởng thành.</p>
                    </div>
                    {canManage ? (
                        <button className="outline-button light-button" onClick={() => onAdd(selectedLevel ?? undefined, selectedSublevel ?? undefined)}>
                            <Plus size={16} /> Thêm chương trình
                        </button>
                    ) : (
                        <button className="outline-button light-button" onClick={() => onBack('industries')}>
                            Xem toàn bộ <ArrowRight size={16} />
                        </button>
                    )}
                </div>
                {selectedIndustry && (
                    <nav className="program-breadcrumb" aria-label="Điều hướng chương trình học">
                        <button onClick={() => onBack('industries')}>Tất cả ngành</button>
                        <span aria-hidden="true">/</span>
                        <button disabled={!selectedSublevel && viewingPrograms} onClick={() => onBack('sublevels')}>
                            {selectedIndustry.level}
                        </button>
                        {selectedSublevel && <><span aria-hidden="true">/</span><span aria-current="page">{selectedSublevel}</span></>}
                    </nav>
                )}
                <div className="program-list">
                    {!selectedIndustry && industries.map((industry) => {
                        const programCount = getProgramsForIndustry(programs, industry.level).length
                        return <button className="program-category-card" style={{ backgroundColor: industryColorHex[industry.color], color: industry.color === 'pink' || industry.color === 'green-light' ? '#29351d' : 'white' }} key={industry.level} onClick={() => onSelectLevel(industry.level)}>
                            <span className="program-category-icon">{industry.icon}</span>
                            <span className="program-category-copy"><strong>{industry.level}</strong><small>{industry.sublevels.length ? `${industry.sublevels.length} phân ngành` : `${programCount} chương trình học`}</small></span>
                            <ArrowRight size={18} />
                        </button>
                    })}
                    {selectedIndustry && !viewingPrograms && selectedIndustry.sublevels.map((sublevel) => {
                        const programCount = getProgramsForSublevel(programs, selectedIndustry.level, sublevel).length
                        return <button className="program-sublevel-row" key={sublevel} onClick={() => onSelectSublevel(sublevel)}>
                            <span><strong>{sublevel}</strong><small>{programCount} chương trình học</small></span>
                            <ArrowRight size={18} />
                        </button>
                    })}
                    {selectedIndustry && viewingPrograms && visiblePrograms.map(renderProgram)}
                    {selectedIndustry && viewingPrograms && !visiblePrograms.length && <p className="program-empty">Chưa có chương trình học cho {selectedSublevel ?? selectedIndustry.level}.</p>}
                </div>
            </div>
        </section>
    )
}
