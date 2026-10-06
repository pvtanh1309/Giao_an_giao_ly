import assert from 'node:assert/strict'
import test from 'node:test'
import { filterReferences } from '../lib/reference-content.ts'

const references = [
    {
        id: 'published-one',
        title: 'Trò chơi sinh hoạt',
        category: 'Sinh hoạt',
        status: 'ACTIVE',
        published: { content: '{"type":"doc"}', version: 2 },
    },
    {
        id: 'draft-only',
        title: 'Kỹ năng lắng nghe',
        category: 'Kỹ năng',
        status: 'ACTIVE',
        draft: { content: '{"type":"doc"}', version: 1 },
    },
    {
        id: 'published-with-draft',
        title: 'Sinh hoạt đầu giờ',
        category: 'Sinh hoạt',
        status: 'ACTIVE',
        draft: { content: '{"type":"doc","draft":true}', version: 3 },
        published: { content: '{"type":"doc","published":true}', version: 2 },
    },
    {
        id: 'deleted',
        title: 'Kỹ năng đã xóa',
        category: 'Kỹ năng',
        status: 'DELETED',
        draft: { content: '{"type":"doc"}', version: 1 },
        published: { content: '{"type":"doc"}', version: 1 },
    },
]

test('filters by exact fixed category and Vietnamese case-insensitive title', () => {
    assert.deepEqual(
        filterReferences(references, 'Sinh hoạt', 'SINH HOẠT', false).map(({ id }) => id),
        ['published-one', 'published-with-draft'],
    )
    assert.deepEqual(filterReferences(references, 'Kỹ năng', '', false), [])
})

test('reader only receives published active metadata, never draft content', () => {
    const results = filterReferences(references, null, '', false)
    assert.deepEqual(results.map(({ id }) => id), ['published-one', 'published-with-draft'])
    assert.ok(results.every((item) => item.status === 'ACTIVE' && item.hasPublished))
    assert.ok(results.every((item) => !('draft' in item) && !('published' in item)))
    assert.equal(results.find(({ id }) => id === 'published-with-draft').hasDraft, true)
})

test('manager sees active draft-only and published-with-draft metadata', () => {
    const results = filterReferences(references, null, '', true)
    assert.deepEqual(results.map(({ id }) => id), ['published-one', 'draft-only', 'published-with-draft'])
    assert.equal(results.find(({ id }) => id === 'draft-only').hasDraft, true)
    assert.equal(results.find(({ id }) => id === 'draft-only').hasPublished, false)
})

test('deleted references are visible only to managers explicitly including deleted items', () => {
    assert.deepEqual(filterReferences(references, null, '', true, true).map(({ id }) => id), [
        'published-one', 'draft-only', 'published-with-draft', 'deleted',
    ])
    assert.ok(!filterReferences(references, null, '', false, true).some(({ id }) => id === 'deleted'))
})

test('empty query does not filter category results', () => {
    assert.deepEqual(
        filterReferences(references, 'Sinh hoạt', '   ', false).map(({ id }) => id),
        ['published-one', 'published-with-draft'],
    )
})
