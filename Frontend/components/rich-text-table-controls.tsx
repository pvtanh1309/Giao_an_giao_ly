'use client'

import { useState } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { Table2 } from 'lucide-react'

const actions = [
    { command: 'addRowBefore', label: 'Thêm hàng phía trên' },
    { command: 'addRowAfter', label: 'Thêm hàng phía dưới' },
    { command: 'deleteRow', label: 'Xóa hàng' },
    { command: 'addColumnBefore', label: 'Thêm cột bên trái' },
    { command: 'addColumnAfter', label: 'Thêm cột bên phải' },
    { command: 'deleteColumn', label: 'Xóa cột' },
    { command: 'mergeCells', label: 'Gộp các ô đã chọn' },
    { command: 'splitCell', label: 'Tách ô đã gộp' },
    { command: 'toggleHeaderRow', label: 'Bật/tắt hàng tiêu đề' },
    { command: 'deleteTable', label: 'Xóa bảng' },
] as const

export function RichTextTableControls({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false)
    const [rows, setRows] = useState('3')
    const [cols, setCols] = useState('2')
    const state = useEditorState({ editor, selector: ({ editor: current }) => ({
        inTable: current.isActive('table'),
        allowed: actions.map(({ command }) => current.can()[command]()),
    }) })
    const valid = /^\d+$/.test(rows) && /^\d+$/.test(cols)
        && Number(rows) >= 1 && Number(rows) <= 200 && Number(cols) >= 1 && Number(cols) <= 40
        && Number(rows) * Number(cols) <= 1000
    return <>
        <button type="button" title="Chèn bảng" aria-label="Chèn bảng" aria-expanded={open}
            onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(!open)}><Table2 size={16} /></button>
        {open && <span className="rich-text-table-insert" role="group" aria-label="Kích thước bảng" title="Tối đa 200 hàng, 40 cột và 1000 ô khi tạo bảng">
            <label>Hàng<input type="number" aria-label="Số hàng" min={1} max={200} value={rows} onChange={(event) => setRows(event.target.value)} /></label>
            <label>Cột<input type="number" aria-label="Số cột" min={1} max={40} value={cols} onChange={(event) => setCols(event.target.value)} /></label>
            <button type="button" className="rich-text-table-insert-button" disabled={!valid} onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                    if (valid && editor.chain().focus().insertTable({ rows: Number(rows), cols: Number(cols), withHeaderRow: false }).run()) setOpen(false)
                }}>Tạo bảng</button>
            {!valid && <span role="status">Chọn 1–200 hàng, 1–40 cột, tối đa 1000 ô.</span>}
        </span>}
        {state.inTable && <select aria-label="Chỉnh sửa bảng" value="" onChange={(event) => {
            const action = actions.find(({ command }) => command === event.target.value)
            if (action) editor.chain().focus()[action.command]().run()
        }}>
            <option value="">Chỉnh sửa bảng</option>
            {actions.map(({ command, label }, index) => <option key={command} value={command} disabled={!state.allowed[index]}>{label}</option>)}
        </select>}
    </>
}
