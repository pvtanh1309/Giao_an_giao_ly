'use client'

import { HeroSection } from './hero-section'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { StatsStrip } from './stats-strip'
import type { PageView } from '../lib/page-data-plan'

type SessionRestoringShellProps = {
    initialView: PageView
    activeNav: string
    mobileMenu: boolean
    referenceLibraryOpen: boolean
    onNavigate: (path: string) => void
    onToggleMenu: () => void
}

const pageTitles: Record<Exclude<PageView, 'overview'>, { kicker: string; title: string; description: string }> = {
    lessons: {
        kicker: 'Thư viện giáo án',
        title: 'Giáo án theo ngành',
        description: 'Chọn ngành học để bắt đầu hành trình đồng hành cùng các em.',
    },
    programs: {
        kicker: 'Lộ trình đào tạo',
        title: 'Chương trình học',
        description: 'Hành trình đức tin được xây dựng phù hợp với từng giai đoạn trưởng thành.',
    },
    catechists: {
        kicker: 'Cộng đoàn phục vụ',
        title: 'Danh sách giáo lý viên',
        description: 'Cùng nhau đồng hành và phục vụ các em trong hành trình đức tin.',
    },
    accounts: {
        kicker: 'Đang kiểm tra quyền truy cập',
        title: 'Đang kiểm tra phiên đăng nhập',
        description: 'Nội dung sẽ hiện sau khi xác nhận quyền của tài khoản.',
    },
}

function PreviewSkeleton({ view, referenceLibraryOpen }: { view: Exclude<PageView, 'overview'>; referenceLibraryOpen: boolean }) {
    const copy = pageTitles[view]
    const previewingReferences = view === 'lessons' && referenceLibraryOpen

    if (view === 'programs') {
        return (
            <section id="programs" className="program-section session-pending-preview" aria-busy="true">
                <header className="program-hero">
                    <div className="program-hero-inner">
                        <div className="section-heading light program-heading">
                            <div>
                                <span className="section-kicker">{copy.kicker}</span>
                                <h2>{copy.title}</h2>
                                <p>{copy.description}</p>
                            </div>
                            <span className="session-skeleton session-pending-action" aria-hidden="true" />
                        </div>
                    </div>
                </header>
                <div className="program-inner">
                    <div className="program-list program-stage-list session-program-skeleton-grid" aria-hidden="true">
                        {Array.from({ length: 5 }, (_, index) => <div className="program-category-card session-program-skeleton-card" key={index}>
                            <span className="program-step-number">{String(index + 1).padStart(2, '0')}</span>
                            <span className="session-skeleton session-skeleton-icon" />
                            <span className="session-skeleton session-skeleton-line" />
                        </div>)}
                    </div>
                </div>
                <p className="sr-only" role="status">Đang kiểm tra phiên đăng nhập…</p>
            </section>
        )
    }

    if (view === 'catechists') {
        return (
            <section className="catechists-section session-pending-preview" aria-busy="true">
                <div className="section-heading">
                    <div>
                        <span className="section-kicker">{copy.kicker}</span>
                        <h2>{copy.title}</h2>
                        <p>{copy.description}</p>
                    </div>
                    <span className="session-skeleton session-pending-search" aria-hidden="true" />
                </div>
                <div className="catechist-grid session-catechist-skeleton-grid" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, index) => <div className="catechist-card session-catechist-skeleton-card" key={index}>
                        <span className="session-skeleton session-skeleton-avatar" />
                        <span className="session-skeleton session-skeleton-line" />
                    </div>)}
                </div>
                <p className="sr-only" role="status">Đang kiểm tra phiên đăng nhập…</p>
            </section>
        )
    }

    if (view === 'accounts') {
        return (
            <section className="accounts-section session-pending-preview" aria-busy="true">
                <div className="accounts-heading">
                    <div>
                        <span className="section-kicker">{copy.kicker}</span>
                        <h1>{copy.title}</h1>
                        <p>{copy.description}</p>
                    </div>
                </div>
                <div className="session-account-skeleton" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => <span className="session-skeleton" key={index} />)}
                </div>
                <p className="sr-only" role="status">Đang kiểm tra phiên đăng nhập…</p>
            </section>
        )
    }

    return (
        <section id="lesson-plans" className="content-section session-pending-preview" aria-busy="true">
            <div className="section-heading">
                <div>
                    <span className="section-kicker">{previewingReferences ? 'Thư viện bổ trợ' : copy.kicker}</span>
                    <h2>{previewingReferences ? 'Tài liệu tham khảo' : copy.title}</h2>
                    <p>{previewingReferences ? 'Gợi ý sinh hoạt và kỹ năng để đồng hành cùng các em.' : copy.description}</p>
                </div>
                <span className="session-skeleton session-pending-search" aria-hidden="true" />
            </div>
            {view === 'lessons' && !referenceLibraryOpen ? (
                <div className="lesson-grid session-lesson-skeleton-grid" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => <div className="session-skeleton session-lesson-skeleton-card" key={index} />)}
                </div>
            ) : (
                <div className="session-reference-skeleton-list" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, index) => <div className="session-skeleton session-reference-skeleton-row" key={index} />)}
                </div>
            )}
            <p className="sr-only" role="status">Đang kiểm tra phiên đăng nhập…</p>
        </section>
    )
}

export function SessionRestoringShell({ initialView, activeNav, mobileMenu, referenceLibraryOpen, onNavigate, onToggleMenu }: SessionRestoringShellProps) {
    return (
        <main className={`site-shell view-${initialView} session-restoring-shell`}>
            <SiteHeader
                activeNav={activeNav}
                mobileMenu={mobileMenu}
                currentUser="reader"
                sessionPending
                onNavigate={onNavigate}
                onLogout={() => {}}
                onToggleMenu={onToggleMenu}
            />
            {initialView === 'overview' ? <>
                <HeroSection onNavigate={onNavigate} />
                <StatsStrip lessonCount={0} industryCount={0} canManage={false} loading />
                <p className="sr-only" role="status">Đang kiểm tra phiên đăng nhập…</p>
            </> : <PreviewSkeleton view={initialView} referenceLibraryOpen={referenceLibraryOpen} />}
            <SiteFooter />
        </main>
    )
}
