export type PageView = 'overview' | 'lessons' | 'programs' | 'catechists' | 'accounts'
export type PrimaryCatalog = 'lessons' | 'programs' | null

export type PageDataPlan = {
    primaryCatalog: PrimaryCatalog
    loadReferences: boolean
}

export function getPageDataPlan(
    view: PageView,
    referenceLibraryOpen: boolean,
    selectedReferenceId: string | null,
    selectedLessonId: string | null = null,
    selectedProgramId: string | null = null,
): PageDataPlan {
    let primaryCatalog: PrimaryCatalog = null
    if (view === 'overview' || (view === 'lessons' && !referenceLibraryOpen && !selectedReferenceId && !selectedLessonId)) {
        primaryCatalog = 'lessons'
    } else if (view === 'programs' && !selectedProgramId) {
        primaryCatalog = 'programs'
    }

    return {
        primaryCatalog,
        loadReferences: view === 'lessons' && referenceLibraryOpen && !selectedReferenceId,
    }
}
