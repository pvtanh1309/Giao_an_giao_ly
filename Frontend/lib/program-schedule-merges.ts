import type { ProgramScheduleColumn, ProgramScheduleRow } from './content-data'

export function mergeProgramScheduleCells(
    row: ProgramScheduleRow,
    columns: ProgramScheduleColumn[],
    selectedColumnIds: string[],
): ProgramScheduleRow {
    if (selectedColumnIds.length < 2 || new Set(selectedColumnIds).size !== selectedColumnIds.length) {
        throw new Error('Chọn ít nhất hai ô liền nhau.')
    }

    const indexes = selectedColumnIds.map((id) => columns.findIndex((column) => column.id === id)).sort((a, b) => a - b)
    if (indexes.some((index) => index < 0) || indexes.some((index, position) => position > 0 && index !== indexes[position - 1] + 1)) {
        throw new Error('Chỉ có thể gộp các ô liền nhau.')
    }

    const group = indexes.map((index) => columns[index].id)
    if ((row.mergedCellGroups ?? []).some((existing) => existing.some((id) => group.includes(id)))) {
        throw new Error('Hãy tách ô đã gộp trước khi gộp lại.')
    }

    const values = { ...row.values }
    for (const id of group.slice(1)) values[id] = ''
    return { ...row, values, mergedCellGroups: [...(row.mergedCellGroups ?? []), group] }
}

export function splitProgramScheduleCells(row: ProgramScheduleRow, group: string[]): ProgramScheduleRow {
    return {
        ...row,
        mergedCellGroups: (row.mergedCellGroups ?? []).filter((existing) => existing.length !== group.length || existing.some((id, index) => id !== group[index])),
    }
}

export function getProgramScheduleCellGroup(row: ProgramScheduleRow, columnId: string): string[] | undefined {
    return row.mergedCellGroups?.find((group) => group[0] === columnId)
}

export function isProgramScheduleCellCovered(row: ProgramScheduleRow, columnId: string): boolean {
    return Boolean(row.mergedCellGroups?.some((group) => group.slice(1).includes(columnId)))
}
