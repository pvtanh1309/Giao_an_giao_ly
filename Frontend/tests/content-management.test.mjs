import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from '../lib/api/client.ts'

const module = await import('../lib/api/content-management.ts').catch(() => null)
const doc = (text) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
const response = (data, meta = {}) => new Response(JSON.stringify({ data, meta }))
const fixture = {
    lessonId: 'lesson_server', title: 'Lời Chúa', summary: 'Mô tả', level: 'Ấu nhi', sublevel: 'Ấu 2',
    lessonNumber: 3, durationMinutes: 45, version: 1, keyPoints: doc('Ý chính'), sentiment: doc('Tâm tình'),
    preparation: doc('Chuẩn bị'), progression: [], sections: [{ key: 'I', title: 'Ổn định', content: doc('Ổn định') }],
}
function service(fetchImpl, manager = true) {
    assert.ok(module?.createContentManagement, 'provide persisted content management')
    return module.createContentManagement(createApiClient({ baseUrl: 'https://content.example.test',
        getAccessToken: async () => 'access-token', onUnauthorized() {}, fetchImpl }), manager)
}

test('lesson saves to the server and a fresh service can read it after reload', async () => {
    let persisted
    const fetchImpl = async (url, init) => {
        assert.equal(init.headers.get('Authorization'), 'Bearer access-token')
        if (init.method === 'POST') {
            assert.equal(url, 'https://content.example.test/manage/lessons')
            persisted = { ...JSON.parse(init.body), lessonId: 'lesson_server', version: 1 }
            return response(persisted)
        }
        assert.equal(url, 'https://content.example.test/manage/lessons/lesson_server')
        return response(persisted)
    }
    const saved = await service(fetchImpl).lessons.save({ id: 'local', title: 'Lời Chúa', excerpt: 'Mô tả',
        tag: 'BÀI 03', time: '45 phút', level: 'Ấu nhi', sublevel: 'Ấu 2', content: '',
        keyPoints: 'Ý chính', sentiment: 'Tâm tình', preparation: 'Chuẩn bị', progression: [], sections: [] })
    assert.equal(saved.id, 'lesson_server')
    assert.equal(saved.version, 1)
    assert.equal(saved.hasDraft, true)
    assert.deepEqual(persisted.keyPoints, doc('Ý chính'))
    assert.equal(persisted.lessonNumber, 3)
    assert.equal(persisted.sublevel, 'Ấu 2')
    const reloaded = await service(fetchImpl).lessons.get(saved.id)
    assert.equal(reloaded.title, 'Lời Chúa')
    assert.equal(reloaded.keyPoints, JSON.stringify(doc('Ý chính')))
})

test('lesson update sends server version and mediaId without transient image URLs', async () => {
    const image = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: {
        mediaId: 'media_abc', src: 'blob:temporary', width: 220, alignment: 'center', alt: 'Ảnh',
    } }] }] }
    const api = service(async (url, init) => {
        if (!init.method) return response(fixture)
        assert.equal(url, 'https://content.example.test/manage/lessons/lesson_server/draft')
        assert.equal(init.method, 'PUT')
        const body = JSON.parse(init.body)
        assert.equal(body.version, 1)
        assert.equal(body.keyPoints.content[0].content[0].attrs.mediaId, 'media_abc')
        assert.ok(!('src' in body.keyPoints.content[0].content[0].attrs))
        return response({ ...body, lessonId: 'lesson_server', version: 2 })
    })
    const item = await api.lessons.get('lesson_server')
    const saved = await api.lessons.save({ ...item, keyPoints: JSON.stringify(image), content: 'Nội dung bổ sung' })
    assert.equal(saved.version, 2)
    assert.equal(JSON.parse(saved.keyPoints).content[0].content[0].attrs.src, 'blob:temporary')
    assert.equal(saved.content, JSON.stringify(doc('Nội dung bổ sung')))
})

test('program schedule preserves documents, every column and merged groups across save/read', async () => {
    const api = service(async (_url, init) => {
        const body = JSON.parse(init.body)
        assert.equal(body.sublevel, 'Chiên con')
        assert.deepEqual(body.schedule[0].values, { a: doc('Chủ đề'), b: { type: 'doc', content: [{ type: 'paragraph' }] } })
        assert.deepEqual(body.schedule[0].mergedCellGroups, [['a', 'b']])
        return response({ ...body, programId: 'program_server', version: 1 })
    })
    const saved = await api.programs.save({ id: 'local', title: 'Năm học', desc: 'Mô tả', level: 'Chiên con',
        scheduleColumns: [{ id: 'a', label: 'Đề tài' }, { id: 'b', label: 'Ghi chú' }],
        schedule: [{ id: 'row', values: { a: JSON.stringify(doc('Chủ đề')) }, mergedCellGroups: [['a', 'b']] }] })
    assert.equal(saved.id, 'program_server')
    assert.equal(saved.schedule[0].values.a, JSON.stringify(doc('Chủ đề')))
    assert.deepEqual(saved.schedule[0].mergedCellGroups, [['a', 'b']])
})

test('references save a draft before publishing with the returned server version', async () => {
    const calls = []
    const api = service(async (url, init) => {
        const body = JSON.parse(init.body)
        calls.push({ url, body })
        return response(url.endsWith('/publish')
            ? { referenceId: 'ref_server', title: 'Trò chơi', category: 'Sinh hoạt', content: doc('Nội dung'), version: 2 }
            : { ...body, referenceId: 'ref_server', version: 1 })
    })
    const saved = await api.references.save({ id: 'new', title: 'Trò chơi', category: 'Sinh hoạt', status: 'ACTIVE', draft: { content: 'Nội dung', version: 99 } })
    assert.deepEqual(calls[0].body.content, doc('Nội dung'))
    assert.equal(saved.version, 1)
    const published = await api.references.publish(saved)
    assert.deepEqual(calls[1].body, { version: 1 })
    assert.equal(published.draft, undefined)
    assert.equal(published.published.content, JSON.stringify(doc('Nội dung')))
})

test('catalog follows pagination, reader uses published routes and managers can discover reference trash', async () => {
    const urls = []
    const api = service(async (url) => {
        urls.push(url)
        return response([fixture], urls.length === 1 ? { nextCursor: 'next+page' } : {})
    }, false)
    assert.equal((await api.lessons.list()).length, 2)
    assert.match(urls[0], /\/lessons\?limit=50$/)
    assert.match(urls[1], /cursor=next%2Bpage/)
    await service(async (url) => {
        assert.match(url, /\/manage\/references\?limit=50&includeDeleted=true$/)
        return response([{ referenceId: 'ref', title: 'Đã xóa', category: 'Kỹ năng', status: 'DELETED', version: 5, hasDraft: true, hasPublished: false }])
    }).references.list()
})

test('archive and restore use persisted IDs and preserve the returned concurrency version', async () => {
    const calls = []
    const api = service(async (url, init) => {
        calls.push([url, init.method])
        return response({ status: url.endsWith('/restore') ? 'ACTIVE' : 'DELETED', version: 3 })
    })
    const archived = await api.references.archive({ id: 'ref', version: 2, title: 'Tài liệu' })
    assert.equal(archived.status, 'DELETED')
    assert.equal((await api.references.restore(archived)).version, 3)
    assert.deepEqual(calls, [
        ['https://content.example.test/manage/references/ref', 'DELETE'],
        ['https://content.example.test/manage/references/ref/restore', 'POST'],
    ])
})

test('failed writes and stale versions reject without manufacturing a successful save', async () => {
    const api = service(async () => new Response(JSON.stringify({ error: { code: 'VERSION_CONFLICT', message: 'Stale version' } }), { status: 409 }))
    await assert.rejects(api.lessons.save({ id: 'lesson_server', version: 1, title: 'Title', level: 'Ấu nhi',
        tag: 'BÀI 01', time: '45 phút', progression: [], sections: [] }), { code: 'VERSION_CONFLICT' })
    await assert.rejects(api.lessons.publish({ id: 'local' }), /lưu/)
})

test('a repeated pagination cursor fails instead of hanging on refresh', async () => {
    const api = service(async () => response([], { nextCursor: 'same' }))
    await assert.rejects(api.programs.list(), /phân trang/)
})

test('readers cannot call management writes even when they hold a published item', async () => {
    let requests = 0
    const api = service(async () => { requests++; return response(fixture) }, false)
    await assert.rejects(api.lessons.save({ ...fixture, id: 'lesson_server' }), /quyền/)
    assert.equal(requests, 0)
})
