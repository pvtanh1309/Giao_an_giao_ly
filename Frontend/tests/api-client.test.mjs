import assert from 'node:assert/strict'
import test from 'node:test'

import { createApiClient } from '../lib/api/client.ts'
import { ApiError } from '../lib/api/errors.ts'
import { createContentApi } from '../lib/api/content.ts'
import { createUsersApi } from '../lib/api/users.ts'

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function createClient(fetchImpl, onUnauthorized = () => {}) {
    return createApiClient({
        baseUrl: 'https://api.example.test/',
        getAccessToken: async () => 'access-token',
        onUnauthorized,
        fetchImpl,
    })
}

test('GET injects a bearer token, omits body headers, and unwraps data envelopes', async () => {
    let request
    const client = createClient(async (url, init) => {
        request = { url, init }
        return jsonResponse({ data: { id: 'lesson-1' }, meta: { requestId: 'req-1' } })
    })

    assert.deepEqual(await client.request('/lessons/lesson-1'), { id: 'lesson-1' })
    assert.equal(request.url, 'https://api.example.test/lessons/lesson-1')
    assert.equal(request.init.headers.get('Authorization'), 'Bearer access-token')
    assert.equal(request.init.headers.has('Content-Type'), false)
    assert.equal(request.init.body, undefined)
})

test('serializes defined request bodies as JSON while preserving caller headers', async () => {
    let request
    const client = createClient(async (_url, init) => {
        request = init
        return jsonResponse({ data: { saved: true }, meta: {} }, 201)
    })

    await client.request('/manage/lessons', {
        method: 'POST',
        headers: { 'X-Request-Source': 'editor' },
        body: { title: 'Bài học' },
    })

    assert.equal(request.body, JSON.stringify({ title: 'Bài học' }))
    assert.equal(request.headers.get('Content-Type'), 'application/json')
    assert.equal(request.headers.get('X-Request-Source'), 'editor')
})

test('accepts successful 204 responses', async () => {
    const client = createClient(async () => new Response(null, { status: 204 }))
    assert.equal(await client.request('/resource', { method: 'DELETE' }), undefined)
})

test('preserves backend error code, details, and requestId', async () => {
    const client = createClient(async () => jsonResponse({
        error: {
            code: 'VALIDATION_ERROR',
            message: 'Dữ liệu chưa hợp lệ.',
            details: [{ field: 'title' }],
        },
        meta: { requestId: 'req-validation' },
    }, 400))

    await assert.rejects(client.request('/manage/lessons', { method: 'POST', body: {} }), (error) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.status, 400)
        assert.equal(error.code, 'VALIDATION_ERROR')
        assert.deepEqual(error.details, [{ field: 'title' }])
        assert.equal(error.requestId, 'req-validation')
        return true
    })
})

test('normalizes network failures and invalid success responses', async () => {
    const networkClient = createClient(async () => { throw new TypeError('private network detail') })
    await assert.rejects(networkClient.request('/lessons'), (error) => {
        assert.ok(error instanceof ApiError)
        assert.equal(error.code, 'NETWORK_ERROR')
        assert.doesNotMatch(error.message, /private network detail/)
        return true
    })

    for (const response of [
        new Response('not-json', { status: 200 }),
        jsonResponse({ meta: { requestId: 'missing-data' } }),
    ]) {
        const invalidClient = createClient(async () => response)
        await assert.rejects(invalidClient.request('/lessons'), (error) => {
            assert.ok(error instanceof ApiError)
            assert.equal(error.code, 'INVALID_RESPONSE')
            return true
        })
    }
})

test('invalidates auth exactly once for each malformed or empty 401', async () => {
    for (const response of [
        new Response(null, { status: 401 }),
        new Response('not-json', { status: 401 }),
    ]) {
        let invalidations = 0
        const client = createClient(async () => response, () => { invalidations += 1 })

        await assert.rejects(client.request('/lessons'), (error) => {
            assert.ok(error instanceof ApiError)
            assert.equal(error.status, 401)
            assert.equal(error.code, 'UNAUTHORIZED')
            return true
        })
        assert.equal(invalidations, 1)
    }
})

test('preserves 403 and 409 responses without invalidating auth', async () => {
    let invalidations = 0
    for (const { status, code } of [
        { status: 403, code: 'FORBIDDEN' },
        { status: 409, code: 'VERSION_CONFLICT' },
    ]) {
        const client = createClient(
            async () => jsonResponse({ error: { code, message: 'Không thể thực hiện.' }, meta: { requestId: `req-${status}` } }, status),
            () => { invalidations += 1 },
        )
        await assert.rejects(client.request('/resource'), (error) => error instanceof ApiError && error.code === code)
    }
    assert.equal(invalidations, 0)
})

test('content and users factories select only their configured base URL', async () => {
    const urls = []
    const options = {
        config: {
            awsRegion: 'ap-southeast-1',
            cognitoUserPoolId: 'pool',
            cognitoClientId: 'client',
            contentApiUrl: 'https://content.example.test',
            usersApiUrl: 'https://users.example.test',
        },
        getAccessToken: async () => 'token',
        onUnauthorized: () => {},
        fetchImpl: async (url) => {
            urls.push(url)
            return jsonResponse({ data: null, meta: {} })
        },
    }

    await createContentApi(options).request('/lessons')
    await createUsersApi(options).request('/catechists')
    assert.deepEqual(urls, ['https://content.example.test/lessons', 'https://users.example.test/catechists'])
})
