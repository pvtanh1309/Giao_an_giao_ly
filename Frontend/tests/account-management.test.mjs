import assert from 'node:assert/strict'
import test from 'node:test'
import { createUsersApi } from '../lib/api/users.ts'
import * as management from '../lib/api/account-management.ts'

const profile = { catechistId: 'cat-real', name: 'Maria', email: 'editor@example.com', group: 'Ấu 1', status: 'ACTIVE', version: 2 }
const reader = { cognitoSub: 'real-cognito-sub', email: 'reader@example.com', role: 'READER', accountStatus: 'ACTIVE', createdAt: '2026-10-15T00:00:00Z' }
const form = { email: 'reader@example.com', password: 'Password!123', confirmPassword: 'Password!123', role: 'reader', linkedCatechistId: 'cat-real' }
function service(fetchImpl) {
    return management.createAccountManagement(createUsersApi({
        config: { usersApiUrl: 'https://users.example.test' },
        getAccessToken: async () => 'verified-access-token', onUnauthorized() {}, fetchImpl,
    }))
}
const response = (data, meta = {}) => new Response(JSON.stringify({ data, meta }))

test('reader creation sends a real authorized POST and uses Cognito sub from the response', async () => {
    const api = service(async (url, init) => {
        assert.equal(url, 'https://users.example.test/admin/accounts')
        assert.equal(init.method, 'POST')
        assert.equal(init.headers.get('Authorization'), 'Bearer verified-access-token')
        assert.deepEqual(JSON.parse(init.body), { email: form.email, password: form.password, role: 'READER', catechistId: 'cat-real' })
        return response(reader)
    })
    const saved = await api.createAccount(form, [{ id: 'cat-real' }])
    assert.equal(saved.id, 'real-cognito-sub')
    assert.equal(saved.status, 'Hoạt động')
    assert.ok(!JSON.stringify(saved).includes(form.password))
})

test('editor creation sends the persisted catechist ID, never an email or temporary ID', async () => {
    const api = service(async (_url, init) => {
        assert.equal(JSON.parse(init.body).catechistId, 'cat-real')
        assert.equal(JSON.parse(init.body).role, 'EDITOR')
        return response({ ...reader, role: 'EDITOR', catechistId: 'cat-real' })
    })
    const profiles = [{ id: 'cat-real', email: 'editor@example.com' }]
    const saved = await api.createAccount({ ...form, role: 'editor', linkedCatechistId: 'cat-real' }, profiles)
    assert.equal(saved.linkedCatechistId, 'cat-real')
    assert.equal(saved.linkedCatechistEmail, 'editor@example.com')
    await assert.rejects(api.createAccount({ ...form, role: 'editor', linkedCatechistId: 'unsaved' }, []))
})

test('failed creation rejects without inventing a successful account', async () => {
    const api = service(async () => new Response(JSON.stringify({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email already exists.' } }), { status: 409 }))
    await assert.rejects(api.createAccount(form, [{ id: 'cat-real' }]), { code: 'EMAIL_ALREADY_EXISTS' })
})

test('account listing follows pagination and maps linked profile IDs', async () => {
    const urls = []
    const api = service(async (url) => {
        urls.push(url)
        return urls.length === 1 ? response([reader], { nextCursor: 'next+page' })
            : response([{ ...reader, cognitoSub: 'editor-sub', role: 'EDITOR', catechistId: 'cat-real', accountStatus: 'DISABLED' }])
    })
    const accounts = await api.listAccounts([{ id: 'cat-real', email: 'editor@example.com' }])
    assert.equal(accounts.length, 2)
    assert.equal(accounts[1].linkedCatechistEmail, 'editor@example.com')
    assert.equal(accounts[1].status, 'Vô hiệu hóa')
    assert.match(urls[1], /cursor=next%2Bpage/)
})

test('profile listing reads persisted IDs needed for editor provisioning', async () => {
    const api = service(async (url) => {
        assert.match(url, /\/catechists\?limit=50$/)
        return response([profile])
    })
    const profiles = await api.listProfiles()
    assert.equal(profiles[0].id, 'cat-real')
    assert.equal(profiles[0].homeroomClass, 'Ấu 1')
})

test('password reset and account transitions call backend routes', async () => {
    const calls = []
    const api = service(async (url, init) => {
        calls.push({ url, method: init.method, body: JSON.parse(init.body ?? '{}') })
        return response(url.endsWith('reset-password') ? { cognitoSub: reader.cognitoSub } : reader)
    })
    const account = { id: reader.cognitoSub, status: 'Hoạt động' }
    await api.resetPassword(account, 'Changed!123')
    await api.updateStatus(account, 'Vô hiệu hóa', [])
    await api.updateStatus(account, 'Đã lưu trữ', [])
    await api.updateStatus({ ...account, status: 'Đã lưu trữ' }, 'Hoạt động', [])
    assert.deepEqual(calls.map(({ url, method }) => [url.split('/').pop(), method]), [
        ['reset-password', 'POST'], ['disable', 'POST'], [reader.cognitoSub, 'DELETE'], ['restore', 'POST'],
    ])
    assert.deepEqual(calls[0].body, { password: 'Changed!123' })
})

test('enabling and relinking use the server account ID and return server values', async () => {
    const api = service(async (url, init) => {
        if (url.endsWith('/enable')) {
            assert.equal(init.method, 'POST')
            return response(reader)
        }
        assert.equal(url, 'https://users.example.test/admin/accounts/real-cognito-sub/catechist-link')
        assert.equal(init.method, 'PUT')
        assert.deepEqual(JSON.parse(init.body), { catechistId: 'cat-real' })
        return response({ ...reader, role: 'EDITOR', catechistId: 'cat-real' })
    })
    const account = { id: reader.cognitoSub, status: 'Vô hiệu hóa' }
    assert.equal((await api.updateStatus(account, 'Hoạt động', [])).status, 'Hoạt động')
    assert.equal((await api.updateLink(account, 'cat-real', [{ id: 'cat-real', email: 'editor@example.com' }])).linkedCatechistId, 'cat-real')
})

test('malformed pages and repeated cursors fail instead of silently truncating or looping', async () => {
    await assert.rejects(service(async () => response({})).listAccounts([]), { code: 'INVALID_RESPONSE' })
    let calls = 0
    const api = service(async () => { calls++; return response([], { nextCursor: 'same' }) })
    await assert.rejects(api.listAccounts([]), /phân trang không hợp lệ/)
    assert.equal(calls, 2)
})

test('profiles sharing an email are distinguished by their persisted ID', async () => {
    const profiles = [{ id: 'first', email: 'shared@example.com' }, { id: 'second', email: 'shared@example.com' }]
    let sent
    const api = service(async (_url, init) => {
        sent = JSON.parse(init.body)
        return response({ ...reader, role: 'EDITOR', catechistId: 'second' })
    })
    const saved = await api.createAccount({ ...form, role: 'editor', linkedCatechistId: 'second' }, profiles)
    assert.equal(sent.catechistId, 'second')
    assert.equal(saved.linkedCatechistId, 'second')
})
