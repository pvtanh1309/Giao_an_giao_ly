'use client'

import type { Catechist, CatechistStatus } from '../lib/content-data'

type CatechistEditorFieldsProps = {
    catechist: Catechist
    onChange: (catechist: Catechist) => void
}

export function CatechistEditorFields({ catechist, onChange }: CatechistEditorFieldsProps) {
    const update = (field: keyof Catechist, value: string) =>
        onChange({ ...catechist, [field]: value })

    return (
        <>
            <label>
                Email
                <input type="email" required value={catechist.email} onChange={(event) => update('email', event.target.value)} placeholder="ten@email.com" />
            </label>
            <label>
                Số điện thoại
                <input type="tel" required value={catechist.phone} onChange={(event) => update('phone', event.target.value)} placeholder="0901 234 567" />
            </label>
            <label>
                Lớp chủ nhiệm
                <input value={catechist.homeroomClass} onChange={(event) => update('homeroomClass', event.target.value)} placeholder="Ví dụ: Ấu 1" />
            </label>
            <label>
                Lớp đồng hành
                <input value={catechist.accompanyingClass} onChange={(event) => update('accompanyingClass', event.target.value)} placeholder="Ví dụ: Thiếu 2" />
            </label>
            <label>
                Trạng thái
                <select
                    value={catechist.status}
                    onChange={(event) => update('status', event.target.value as CatechistStatus)}
                >
                    <option value="Còn hoạt động">Còn hoạt động</option>
                    <option value="Tạm nghỉ">Tạm nghỉ</option>
                    <option value="Đã nghỉ">Đã nghỉ</option>
                </select>
            </label>
        </>
    )
}
