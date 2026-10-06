import type { ProgramScheduleColumn } from './content-data'

export function insertProgramScheduleColumn(
    columns: ProgramScheduleColumn[],
    column: ProgramScheduleColumn,
    afterId?: string,
): ProgramScheduleColumn[] {
    if (!afterId) return [...columns, column]
    const anchorIndex = columns.findIndex((item) => item.id === afterId)
    if (anchorIndex < 0) return [...columns, column]
    return [...columns.slice(0, anchorIndex + 1), column, ...columns.slice(anchorIndex + 1)]
}

export function moveProgramScheduleColumn(
    columns: ProgramScheduleColumn[],
    columnId: string,
    direction: 'left' | 'right',
): ProgramScheduleColumn[] {
    const index = columns.findIndex((item) => item.id === columnId)
    const targetIndex = direction === 'left' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= columns.length) return [...columns]
    const next = [...columns]
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    return next
}
