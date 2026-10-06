'use client'

import { ArrowLeft, ArrowRight, BookOpenText, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import type { ReferenceCategory, ReferenceDocument } from '../lib/reference-content'
import { filterReferences } from '../lib/reference-content'

type ReferenceDirectoryProps = {
    references: ReferenceDocument[]
    category: ReferenceCategory | null
    query: string
    canManage: boolean
    onBack: () => void
    onCategoryChange: (category: ReferenceCategory | null) => void
    onQueryChange: (query: string) => void
    onOpenReference: (reference: ReferenceDocument) => void
    onCreate: (category: ReferenceCategory) => void
}

const categories: ReferenceCategory[] = ['Sinh hoạt', 'Kỹ năng']

export function ReferenceDirectory({
    references,
    category,
    query,
    canManage,
    onBack,
    onCategoryChange,
    onQueryChange,
    onOpenReference,
    onCreate,
}: ReferenceDirectoryProps) {
    const [includeDeleted, setIncludeDeleted] = useState(false)
    const items = filterReferences(references, category, query, canManage, includeDeleted)

    return (
        <section className="reference-directory content-section" aria-label="Thư viện tài liệu tham khảo">
            <div className="reference-directory-heading">
                <button className="secondary-button" onClick={onBack}><ArrowLeft size={16} /> Giáo án</button>
                <div>
                    <span className="section-kicker">Thư viện bổ trợ</span>
                    <h1>Tài liệu tham khảo</h1>
                    <p>Gợi ý sinh hoạt và kỹ năng để đồng hành cùng các em.</p>
                </div>
            </div>

            <div className="reference-category-tabs" aria-label="Nhóm tài liệu">
                <button className={!category ? 'is-selected' : ''} onClick={() => onCategoryChange(null)}>Tất cả</button>
                {categories.map((item) => (
                    <button key={item} className={category === item ? 'is-selected' : ''} onClick={() => onCategoryChange(item)}>{item}</button>
                ))}
            </div>

            <div className="reference-directory-tools">
                <label className="directory-search">
                    <Search size={17} aria-hidden="true" />
                    <input type="search" aria-label="Tìm tài liệu tham khảo" placeholder="Tìm theo tiêu đề" value={query} onChange={(event) => onQueryChange(event.target.value)} />
                </label>
                {canManage && <button className="primary-button" onClick={() => onCreate(category ?? 'Sinh hoạt')}><Plus size={16} /> Thêm tài liệu</button>}
            </div>

            {canManage && <label className="reference-trash-toggle">
                <input type="checkbox" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} />
                Hiển thị tài liệu đã xóa
            </label>}

            {items.length ? <div className="reference-list">
                {items.map((item) => (
                    <button className="reference-list-item" key={item.id} onClick={() => onOpenReference(references.find((reference) => reference.id === item.id)!)}>
                        <span className="reference-list-icon"><BookOpenText size={20} /></span>
                        <span className="reference-list-copy">
                            <strong>{item.title}</strong>
                            <small>{item.category}{item.hasDraft ? ' · Có bản nháp' : ''}{item.status === 'DELETED' ? ' · Đã xóa' : ''}</small>
                        </span>
                        <ArrowRight size={17} aria-hidden="true" />
                    </button>
                ))}
            </div> : <div className="reference-empty-state">
                <BookOpenText size={28} />
                <h2>{query.trim() ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu tham khảo'}</h2>
                <p>{canManage ? 'Tạo tài liệu đầu tiên để bổ sung hoạt động và kỹ năng cho giáo án.' : 'Tài liệu đã xuất bản sẽ xuất hiện tại đây.'}</p>
            </div>}
        </section>
    )
}
