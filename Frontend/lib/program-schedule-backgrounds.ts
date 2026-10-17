import type { ProgramScheduleRow } from './content-data'

const validColor = (color: unknown): color is string => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)

export function getProgramCellBackground(row: ProgramScheduleRow | undefined, columnId: string): string | undefined {
    const color = row?.cellBackgrounds?.[columnId]
    return validColor(color) ? color : undefined
}

export function setProgramCellBackground(row: ProgramScheduleRow, columnId: string, color?: string): ProgramScheduleRow {
    const cellBackgrounds = { ...row.cellBackgrounds }
    if (color !== undefined) {
        if (!validColor(color)) throw new Error('Màu nền ô không hợp lệ.')
        cellBackgrounds[columnId] = color.toLowerCase()
    } else delete cellBackgrounds[columnId]
    return { ...row, cellBackgrounds: Object.keys(cellBackgrounds).length ? cellBackgrounds : undefined }
}
