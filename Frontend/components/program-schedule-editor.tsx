'use client'

import { ArrowLeft, ArrowRight, Plus, Trash2, Type, X } from 'lucide-react'
import { useState } from 'react'
import {
    createEmptyProgramScheduleRow,
    type ProgramScheduleColumn,
    type ProgramScheduleRow,
} from '../lib/content-data'
import { insertProgramScheduleColumn, moveProgramScheduleColumn } from '../lib/program-schedule-columns'
import { getProgramScheduleCellGroup, isProgramScheduleCellCovered, mergeProgramScheduleCells, splitProgramScheduleCells } from '../lib/program-schedule-merges'
import { ProgramScheduleCellContent } from './program-schedule-cell-content'
import { ProgramScheduleFormatDialog } from './program-schedule-format-dialog'

type ProgramScheduleEditorProps = {
    columns: ProgramScheduleColumn[]
    rows: ProgramScheduleRow[]
    onColumnsChange: (columns: ProgramScheduleColumn[]) => void
    onChange: (rows: ProgramScheduleRow[]) => void
}

const makeColumnId = () => `column-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function ProgramScheduleEditor({ columns, rows, onColumnsChange, onChange }: ProgramScheduleEditorProps) {
    const [columnDialog, setColumnDialog] = useState<'add' | 'remove' | null>(null)
    const [newColumnLabel, setNewColumnLabel] = useState('')
    const [insertAfterColumnId, setInsertAfterColumnId] = useState('')
    const [columnToRemove, setColumnToRemove] = useState<ProgramScheduleColumn | null>(null)
    const [columnError, setColumnError] = useState('')
    const [formatCell, setFormatCell] = useState<{ rowId: string; column: ProgramScheduleColumn; rowIndex: number } | null>(null)
    const [selectingCells, setSelectingCells] = useState(false)
    const [mergeSelection, setMergeSelection] = useState<{ rowId: string; columnIds: string[] } | null>(null)
    const [mergeError, setMergeError] = useState('')
    const [confirmMerge, setConfirmMerge] = useState(false)

    const selectedIndexes = (mergeSelection?.columnIds ?? []).map((id) => columns.findIndex((column) => column.id === id)).sort((a, b) => a - b)
    const selectionIsContiguous = selectedIndexes.length > 1 && selectedIndexes.every((index, position) => position === 0 || index === selectedIndexes[position - 1] + 1)
    const hasMergedCells = rows.some((row) => Boolean(row.mergedCellGroups?.length))

    const toggleCellSelection = (rowId: string, columnId: string) => {
        const row = rows.find((item) => item.id === rowId)
        if (row && (getProgramScheduleCellGroup(row, columnId) || isProgramScheduleCellCovered(row, columnId))) {
            setMergeError('Tách ô đã gộp trước khi chọn các ô để gộp lại.')
            return
        }
        if (mergeSelection && mergeSelection.rowId !== rowId) {
            setMergeError('Chỉ chọn các ô trong cùng một hàng.')
            return
        }
        setMergeError('')
        setMergeSelection((current) => {
            const ids = current?.rowId === rowId ? current.columnIds : []
            return { rowId, columnIds: ids.includes(columnId) ? ids.filter((id) => id !== columnId) : [...ids, columnId] }
        })
    }

    const mergeSelectedCells = () => {
        if (!mergeSelection || !selectionIsContiguous) return
        const row = rows.find((item) => item.id === mergeSelection.rowId)
        const orderedIds = [...mergeSelection.columnIds].sort((a, b) => columns.findIndex((item) => item.id === a) - columns.findIndex((item) => item.id === b))
        if (orderedIds.slice(1).some((id) => Boolean(row?.values[id]))) {
            setConfirmMerge(true)
            return
        }
        applyMerge()
    }

    const applyMerge = () => {
        if (!mergeSelection || !selectionIsContiguous) return
        try {
            onChange(rows.map((row) => row.id === mergeSelection.rowId
                ? mergeProgramScheduleCells(row, columns, mergeSelection.columnIds)
                : row))
            setMergeSelection(null)
            setSelectingCells(false)
            setMergeError('')
            setConfirmMerge(false)
        } catch (error) {
            setMergeError(error instanceof Error ? error.message : 'Không thể gộp các ô đã chọn.')
        }
    }

    const openAddColumnDialog = () => {
        setNewColumnLabel('')
        setInsertAfterColumnId('')
        setColumnError('')
        setColumnDialog('add')
    }

    const addColumn = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const label = newColumnLabel.trim()
        if (!label) {
            setColumnError('Vui lòng nhập tên cột.')
            return
        }
        const column = { id: makeColumnId(), label }
        onColumnsChange(insertProgramScheduleColumn(columns, column, insertAfterColumnId || undefined))
        onChange(rows.map((row) => ({ ...row, values: { ...row.values, [column.id]: '' } })))
        setColumnDialog(null)
    }

    const openRemoveColumnDialog = (column: ProgramScheduleColumn) => {
        setColumnToRemove(column)
        setColumnDialog('remove')
    }

    const removeColumn = () => {
        if (!columnToRemove || columns.length <= 1) return
        onColumnsChange(columns.filter((item) => item.id !== columnToRemove.id))
        onChange(rows.map(({ values, ...row }) => {
            const nextValues = { ...values }
            delete nextValues[columnToRemove.id]
            return { ...row, values: nextValues }
        }))
        setColumnDialog(null)
        setColumnToRemove(null)
    }

    return (
        <section className="program-schedule-editor">
            <div className="program-schedule-heading">
                <strong>Lịch học theo tuần</strong>
                <div className="program-schedule-tools">
                    <button type="button" className={selectingCells ? 'primary-button' : 'outline-button'} onClick={() => { setSelectingCells((active) => !active); setMergeSelection(null); setMergeError('') }}>{selectingCells ? 'Hủy chọn ô' : 'Chọn ô để gộp'}</button>
                    {selectingCells && <button type="button" className="primary-button" disabled={!selectionIsContiguous} onClick={mergeSelectedCells}>Gộp {mergeSelection?.columnIds.length ?? 0} ô</button>}
                    <button type="button" className="outline-button" disabled={hasMergedCells} title={hasMergedCells ? 'Hãy tách các ô đã gộp trước khi thay đổi cột' : undefined} onClick={openAddColumnDialog}><Plus size={15} /> Thêm cột</button>
                    <button type="button" className="outline-button" onClick={() => onChange([...rows, createEmptyProgramScheduleRow(columns)])}><Plus size={15} /> Thêm buổi</button>
                </div>
            </div>
            {selectingCells && <p className="schedule-merge-hint">Chọn ít nhất hai ô liền nhau trong cùng hàng. Khi gộp, chỉ giữ nội dung của ô đầu tiên bên trái.</p>}
            {mergeError && <p className="schedule-merge-error" role="status">{mergeError}</p>}
            <div className="schedule-table-wrap schedule-editor-wrap">
                <table className="schedule-table schedule-editor-table">
                    <thead><tr>
                        {columns.map((column) => <th key={column.id}>
                            <span className="schedule-column-heading">
                                <input aria-label={`Tên cột ${column.label}`} value={column.label} onChange={(event) => onColumnsChange(columns.map((item) => item.id === column.id ? { ...item, label: event.target.value } : item))} />
                                <span className="schedule-column-tools">
                                    <button type="button" className="schedule-row-remove" aria-label={`Di chuyển ${column.label} sang trái`} title={hasMergedCells ? 'Hãy tách các ô đã gộp trước khi sắp xếp cột' : 'Di chuyển sang trái'} disabled={hasMergedCells || columns[0]?.id === column.id} onClick={() => onColumnsChange(moveProgramScheduleColumn(columns, column.id, 'left'))}><ArrowLeft size={14} /></button>
                                    <button type="button" className="schedule-row-remove" aria-label={`Di chuyển ${column.label} sang phải`} title={hasMergedCells ? 'Hãy tách các ô đã gộp trước khi sắp xếp cột' : 'Di chuyển sang phải'} disabled={hasMergedCells || columns[columns.length - 1]?.id === column.id} onClick={() => onColumnsChange(moveProgramScheduleColumn(columns, column.id, 'right'))}><ArrowRight size={14} /></button>
                                <button type="button" className="schedule-row-remove" aria-label={`Xóa cột ${column.label}`} title={hasMergedCells ? 'Hãy tách các ô đã gộp trước khi xóa cột' : columns.length <= 1 ? 'Chương trình cần có ít nhất một cột' : `Xóa cột ${column.label}`} disabled={hasMergedCells || columns.length <= 1} onClick={() => openRemoveColumnDialog(column)}><Trash2 size={14} /></button>
                                </span>
                            </span>
                        </th>)}
                        <th aria-label="Thao tác" />
                    </tr></thead>
                    <tbody>{rows.map((row, rowIndex) => <tr key={row.id}>
                        {columns.map((column) => {
                            if (isProgramScheduleCellCovered(row, column.id)) return null
                            const group = getProgramScheduleCellGroup(row, column.id)
                            const selected = mergeSelection?.rowId === row.id && mergeSelection.columnIds.includes(column.id)
                            return <td key={column.id} data-label={column.label} colSpan={group?.length}>
                                <div className={`schedule-editor-cell${selected ? ' is-merge-selected' : ''}`}>
                                    <button type="button" className="schedule-cell-content-button" aria-label={selectingCells ? `Chọn ô ${column.label}, dòng ${rowIndex + 1}` : `Chỉnh sửa ${column.label}, dòng ${rowIndex + 1}`} aria-pressed={selectingCells ? selected : undefined} onClick={() => selectingCells ? toggleCellSelection(row.id, column.id) : setFormatCell({ rowId: row.id, column, rowIndex })}>
                                        {row.values[column.id] ? <ProgramScheduleCellContent value={row.values[column.id]} /> : <span className="schedule-cell-placeholder">Bấm để nhập nội dung</span>}
                                    </button>
                                    {group ? <button type="button" className="schedule-cell-split-button" aria-label={`Tách ô đã gộp bắt đầu ở ${column.label}, dòng ${rowIndex + 1}`} title="Tách ô" onClick={() => onChange(rows.map((current) => current.id === row.id ? splitProgramScheduleCells(current, group) : current))}>Tách ô</button> : !selectingCells && <button type="button" className="schedule-cell-format-button" aria-label={`Định dạng ${column.label}, dòng ${rowIndex + 1}`} title="Định dạng văn bản" onClick={() => setFormatCell({ rowId: row.id, column, rowIndex })}><Type size={15} /></button>}
                                </div>
                            </td>
                        })}
                        <td data-label="Thao tác"><button type="button" className="schedule-row-remove" aria-label={`Xóa dòng ${rowIndex + 1}`} onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}><Trash2 size={15} /></button></td>
                    </tr>)}</tbody>
                </table>
            </div>
            {formatCell && <ProgramScheduleFormatDialog
                value={rows.find((row) => row.id === formatCell.rowId)?.values[formatCell.column.id] ?? ''}
                ariaLabel={`${formatCell.column.label}, dòng ${formatCell.rowIndex + 1}`}
                onCancel={() => setFormatCell(null)}
                onSave={(value) => {
                    onChange(rows.map((row) => row.id === formatCell.rowId
                        ? { ...row, values: { ...row.values, [formatCell.column.id]: value } }
                        : row))
                    setFormatCell(null)
                }}
            />}
            {columnDialog && <div className="schedule-column-dialog-backdrop" onKeyDown={(event) => { if (event.key === 'Escape') setColumnDialog(null) }} onClick={(event) => { if (event.target === event.currentTarget) setColumnDialog(null) }}>
                <section className="schedule-column-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-column-dialog-title" aria-describedby="schedule-column-dialog-description">
                    <button type="button" className="schedule-column-dialog-close" onClick={() => setColumnDialog(null)} aria-label="Đóng"><X size={18} /></button>
                    {columnDialog === 'add' ? <form onSubmit={addColumn}>
                        <span className="section-kicker">Tùy chỉnh chương trình</span>
                        <h2 id="schedule-column-dialog-title">Thêm cột mới</h2>
                        <p id="schedule-column-dialog-description">Đặt tên cho cột sẽ hiển thị trong lịch học của chương trình này.</p>
                        <label htmlFor="schedule-column-name">Tên cột</label>
                        <input id="schedule-column-name" autoFocus value={newColumnLabel} onChange={(event) => { setNewColumnLabel(event.target.value); setColumnError('') }} placeholder="Ví dụ: Ngày sinh hoạt" aria-invalid={Boolean(columnError)} aria-describedby={columnError ? 'schedule-column-error' : undefined} />
                        <label htmlFor="schedule-column-position">Vị trí cột mới</label>
                        <select id="schedule-column-position" value={insertAfterColumnId} onChange={(event) => setInsertAfterColumnId(event.target.value)}>
                            <option value="">Cuối danh sách</option>
                            {columns.map((column) => <option key={column.id} value={column.id}>Sau: {column.label}</option>)}
                        </select>
                        {columnError && <p className="schedule-column-error" id="schedule-column-error">{columnError}</p>}
                        <div className="schedule-column-dialog-actions"><button type="button" className="secondary-button" onClick={() => setColumnDialog(null)}>Hủy</button><button type="submit" className="primary-button">Thêm cột</button></div>
                    </form> : <div>
                        <span className="section-kicker">Xóa cột chương trình</span>
                        <h2 id="schedule-column-dialog-title">Xóa “{columnToRemove?.label}”?</h2>
                        <p id="schedule-column-dialog-description">Toàn bộ nội dung trong cột này của chương trình sẽ bị xóa.</p>
                        <div className="schedule-column-dialog-actions"><button type="button" className="secondary-button" onClick={() => setColumnDialog(null)}>Giữ lại</button><button type="button" className="admin-danger-button" onClick={removeColumn}>Xóa cột</button></div>
                    </div>}
                </section>
            </div>}
            {confirmMerge && <div className="schedule-column-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setConfirmMerge(false) }}>
                <section className="schedule-column-dialog" role="alertdialog" aria-modal="true" aria-labelledby="schedule-merge-confirm-title" aria-describedby="schedule-merge-confirm-description">
                    <span className="section-kicker">Xác nhận gộp ô</span>
                    <h2 id="schedule-merge-confirm-title">Bỏ nội dung ở các ô còn lại?</h2>
                    <p id="schedule-merge-confirm-description">Chỉ nội dung của ô đầu tiên bên trái được giữ lại. Những ô khác đang có nội dung sẽ bị xóa.</p>
                    <div className="schedule-column-dialog-actions">
                        <button type="button" className="secondary-button" onClick={() => setConfirmMerge(false)}>Quay lại</button>
                        <button type="button" className="admin-danger-button" onClick={applyMerge}>Gộp và bỏ nội dung</button>
                    </div>
                </section>
            </div>}
        </section>
    )
}
