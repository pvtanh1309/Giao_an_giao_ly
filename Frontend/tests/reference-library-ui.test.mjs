import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('lesson directory keeps industry cards and offers a separate reference-library entry', async () => {
    const directory = await source('../components/lesson-directory.tsx')
    assert.match(directory, /industries\.map\(/)
    assert.match(directory, /Tài liệu tham khảo/)
    assert.match(directory, /onOpenReferences/)
})

test('reference directory exposes only the two fixed categories and manager-only deleted items', async () => {
    const directory = await source('../components/reference-directory.tsx')
    assert.match(directory, /Sinh hoạt/)
    assert.match(directory, /Kỹ năng/)
    assert.match(directory, /includeDeleted/)
    assert.match(directory, /canManage/)
})

test('reference reading page provides management actions only to managers', async () => {
    const page = await source('../components/reference-reading-page.tsx')
    assert.match(page, /canManage &&/)
    assert.match(page, /Lưu nháp/)
    assert.match(page, /Xuất bản/)
    assert.match(page, /Khôi phục/)
})

test('reference view state is encoded in query parameters for static-compatible navigation', async () => {
    const page = await source('../app/page.tsx')
    assert.match(page, /referenceId/)
    assert.match(page, /referenceCategory/)
    assert.match(page, /pushState/)
    assert.match(page, /popstate/)
})
