export type ReferenceCategory = 'Sinh hoạt' | 'Kỹ năng'

export type ReferenceRevision = {
    content: string
    version: number
}

export type ReferenceDocument = {
    id: string
    title: string
    category: ReferenceCategory
    status: 'ACTIVE' | 'DELETED'
    draft?: ReferenceRevision
    published?: ReferenceRevision
}

export type ReferenceListItem = {
    id: string
    title: string
    category: ReferenceCategory
    status: 'ACTIVE' | 'DELETED'
    hasDraft: boolean
    hasPublished: boolean
}

export function filterReferences(
    references: ReferenceDocument[],
    category: ReferenceCategory | null,
    query: string,
    canManage: boolean,
    includeDeleted = false,
): ReferenceListItem[] {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')

    return references
        .filter((reference) => {
            if (category && reference.category !== category) return false
            if (normalizedQuery && !reference.title.toLocaleLowerCase('vi').includes(normalizedQuery)) return false

            if (!canManage) {
                return reference.status === 'ACTIVE' && Boolean(reference.published)
            }

            if (reference.status === 'DELETED') return includeDeleted
            return Boolean(reference.draft || reference.published)
        })
        .map(({ id, title, category: referenceCategory, status, draft, published }) => ({
            id,
            title,
            category: referenceCategory,
            status,
            hasDraft: Boolean(draft),
            hasPublished: Boolean(published),
        }))
}
