import assert from 'node:assert/strict'
import test from 'node:test'

const contentModule = await import('../lib/program-schedule-content.ts').catch(() => null)
const columnsModule = await import('../lib/program-schedule-columns.ts').catch(() => null)
const mergesModule = await import('../lib/program-schedule-merges.ts').catch(() => null)

test('program schedule rich text keeps marks and paragraph alignment when parsed', () => {
    assert.ok(contentModule?.parseProgramScheduleCell, 'provide a program schedule content parser')

    const formatted = {
        type: 'doc',
        content: [{
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{
                type: 'text',
                text: 'Lời nhấn mạnh',
                marks: [
                    { type: 'bold' },
                    { type: 'textStyle', attrs: { color: '#8d4d51', fontSize: '24px' } },
                ],
            }],
        }],
    }
    const legacy = contentModule.parseProgramScheduleCell('Tuần đầu\nSinh hoạt khai mạc')

    assert.deepEqual(contentModule.parseProgramScheduleCell(JSON.stringify(formatted)), formatted)
    assert.deepEqual(legacy.content.map((paragraph) => paragraph.content?.[0]?.text ?? ''), ['Tuần đầu', 'Sinh hoạt khai mạc'])
    assert.equal(contentModule.getProgramScheduleCellText(JSON.stringify(formatted)), 'Lời nhấn mạnh')
})

test('program schedule columns can be inserted beside a chosen column and moved without changing cell values', () => {
    assert.ok(columnsModule?.insertProgramScheduleColumn, 'provide insertion by anchor column')
    assert.ok(columnsModule?.moveProgramScheduleColumn, 'provide column reordering')

    const columns = [{ id: 'date', label: 'Ngày' }, { id: 'topic', label: 'Đề tài' }, { id: 'notes', label: 'Ghi chú' }]
    const inserted = { id: 'week', label: 'Tuần' }
    const rows = [{ id: 'row-1', values: { date: '01/01', topic: 'Chủ đề', notes: 'Ghi chú' } }]

    assert.deepEqual(columnsModule.insertProgramScheduleColumn(columns, inserted, 'date').map(({ id }) => id), ['date', 'week', 'topic', 'notes'])
    assert.deepEqual(columnsModule.moveProgramScheduleColumn(columns, 'notes', 'left').map(({ id }) => id), ['date', 'notes', 'topic'])
    assert.equal(rows[0].values.notes, 'Ghi chú')
})

test('merging adjacent schedule cells keeps the first value and splitting restores empty cells', () => {
    assert.ok(mergesModule?.mergeProgramScheduleCells, 'provide schedule cell merging')
    assert.ok(mergesModule?.splitProgramScheduleCells, 'provide schedule cell splitting')

    const columns = [{ id: 'date', label: 'Ngày' }, { id: 'topic', label: 'Đề tài' }, { id: 'notes', label: 'Ghi chú' }]
    const row = { id: 'row-1', values: { date: 'Lễ Phục Sinh', topic: 'Bỏ nội dung này', notes: '' } }
    const merged = mergesModule.mergeProgramScheduleCells(row, columns, ['date', 'topic'])

    assert.deepEqual(merged.mergedCellGroups, [['date', 'topic']])
    assert.deepEqual(merged.values, { date: 'Lễ Phục Sinh', topic: '', notes: '' })

    const split = mergesModule.splitProgramScheduleCells(merged, ['date', 'topic'])
    assert.deepEqual(split.mergedCellGroups, [])
    assert.deepEqual(split.values, { date: 'Lễ Phục Sinh', topic: '', notes: '' })
})

test('schedule cells cannot be merged when the selected columns are not adjacent', () => {
    assert.ok(mergesModule?.mergeProgramScheduleCells, 'provide schedule cell merging')
    const columns = [{ id: 'date', label: 'Ngày' }, { id: 'topic', label: 'Đề tài' }, { id: 'notes', label: 'Ghi chú' }]
    const row = { id: 'row-1', values: { date: '', topic: '', notes: '' } }

    assert.throws(() => mergesModule.mergeProgramScheduleCells(row, columns, ['date', 'notes']), /liền nhau/)
})
