'use client'

import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import type { Catechist } from '../lib/content-data'

type CatechistDirectoryProps = {
    canManage: boolean
    catechists: Catechist[]
    query: string
    onQueryChange: (query: string) => void
    onAdd: () => void
    onEdit: (catechist: Catechist) => void
    onDelete: (catechist: Catechist) => void
}

export function CatechistDirectory({
    canManage,
    catechists,
    query,
    onQueryChange,
    onAdd,
    onEdit,
    onDelete,
}: CatechistDirectoryProps) {
    const [expandedCatechistEmail, setExpandedCatechistEmail] = useState<string | null>(null)

    return (
        <section className="catechists-section">
            <div className="section-heading">
                <div>
                    <span className="section-kicker">Cộng đoàn phục vụ</span>
                    <h2>Danh sách giáo lý viên</h2>
                    <p>Cùng nhau đồng hành và phục vụ các em trong hành trình đức tin.</p>
                </div>
                <div className="section-heading-actions">
                    <label className="directory-search">
                        <Search size={17} aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Tìm giáo lý viên"
                            placeholder="Tìm theo tên, email, lớp hoặc trạng thái"
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                        />
                    </label>
                    {canManage ? (
                        <button className="outline-button" onClick={onAdd}>
                            <Plus size={16} /> Thêm giáo lý viên
                        </button>
                    ) : (
                        <span className="catechist-count">
                            <Users size={17} /> {catechists.length} giáo lý viên
                        </span>
                    )}
                </div>
            </div>
            <div className="catechist-grid">
                {catechists.map((catechist) => (
                    <article className="catechist-card" key={catechist.email}>
                        <div className="catechist-avatar" aria-hidden="true">
                            {catechist.name.split(' ').map((part) => part[0]).slice(-2).join('')}
                        </div>
                        <div className="catechist-info">
                            <h3>
                                <button
                                    type="button"
                                    className="catechist-name-button"
                                    aria-expanded={expandedCatechistEmail === catechist.email}
                                    onClick={() => setExpandedCatechistEmail((current) => current === catechist.email ? null : catechist.email)}
                                >
                                    {catechist.name}
                                </button>
                            </h3>
                            <span>
                                <strong>Lớp chủ nhiệm: {catechist.homeroomClass || '—'}</strong>
                                <strong>Lớp đồng hành: {catechist.accompanyingClass || '—'}</strong>
                            </span>
                            {expandedCatechistEmail === catechist.email && (
                                <div className="catechist-contact-details" aria-label={`Thông tin liên hệ của ${catechist.name}`}>
                                    <a href={`tel:${catechist.phone.replace(/\s/g, '')}`}>{catechist.phone}</a>
                                    <a href={`mailto:${catechist.email}`}>{catechist.email}</a>
                                </div>
                            )}
                        </div>
                        {canManage && (
                            <span className="admin-card-actions">
                                <button type="button" onClick={() => onEdit(catechist)}>
                                    <Pencil size={14} /> Sửa
                                </button>
                                <button type="button" onClick={() => onDelete(catechist)}>
                                    <Trash2 size={14} /> Xóa
                                </button>
                            </span>
                        )}
                    </article>
                ))}
                {!catechists.length && <p>Không tìm thấy giáo lý viên phù hợp.</p>}
            </div>
        </section>
    )
}
