import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { optimizeLessonImage, stripRuntimeImageUrls, uploadLessonImage, validateLessonImage } from '../lib/lesson-media.ts'

const file = (type, size = 256) => ({ type, size, name: 'lesson-image' })

test('accepts JPEG, PNG, and WebP images only', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) assert.deepEqual(validateLessonImage(file(type)), { ok: true })
    for (const type of ['image/svg+xml', 'image/gif', 'application/octet-stream', '']) assert.equal(validateLessonImage(file(type)).ok, false)
})

test('accepts the exact 5 MiB boundary and rejects a larger file', () => {
    assert.deepEqual(validateLessonImage(file('image/jpeg', 5 * 1024 * 1024)), { ok: true })
    assert.equal(validateLessonImage(file('image/jpeg', 5 * 1024 * 1024 + 1)).ok, false)
})

test('removes runtime source URLs while preserving stable image attributes without mutating input', () => {
    const input = { type: 'doc', content: [{ type: 'image', attrs: { src: 'blob:preview', mediaId: 'm-1', alt: 'Ảnh minh họa', width: 220, alignment: 'center' } }] }
    const output = stripRuntimeImageUrls(input)
    assert.deepEqual(output.content[0].attrs, { mediaId: 'm-1', alt: 'Ảnh minh họa', width: 220, alignment: 'center' })
    assert.equal(input.content[0].attrs.src, 'blob:preview')
})

test('signs metadata then uploads only to the returned URL and returns a preview URL', async () => {
    const calls = []
    const uploadFile = new File(['small image bytes'], 'test.png', { type: 'image/png' })
    const fetchImpl = async (url, init) => {
        calls.push({ url, init })
        return calls.length === 1
            ? { ok: true, json: async () => ({ data: { mediaId: 'media-1', uploadUrl: 'https://private-s3.example/upload', requiredHeaders: { 'Content-Type': 'image/png' } } }) }
            : { ok: true }
    }

    const result = await uploadLessonImage({
        lessonId: 'lesson-1',
        file: uploadFile,
        apiBaseUrl: 'https://content-api.example',
        getAccessToken: async () => 'access-token',
        fetchImpl,
    })

    assert.equal(calls[0].url, 'https://content-api.example/manage/lessons/lesson-1/media-upload-url')
    assert.deepEqual(JSON.parse(calls[0].init.body), { mimeType: 'image/png', sizeBytes: uploadFile.size })
    assert.equal(calls[0].init.headers.Authorization, 'Bearer access-token')
    assert.equal(calls[1].url, 'https://private-s3.example/upload')
    assert.equal(calls[1].init.body, uploadFile)
    assert.equal(result.mediaId, 'media-1')
    assert.match(result.previewSrc, /^blob:/)
})

test('does not upload unsupported files and rejects on signing or PUT failure', async () => {
    let requests = 0
    const invalidFile = new File(['x'], 'image.svg', { type: 'image/svg+xml' })
    await assert.rejects(uploadLessonImage({
        lessonId: 'lesson-1', file: invalidFile, apiBaseUrl: 'https://api', getAccessToken: async () => 'token',
        fetchImpl: async () => { requests += 1; return { ok: true } },
    }), /JPEG, PNG hoặc WebP/)
    assert.equal(requests, 0)

    const validFile = new File(['x'], 'image.png', { type: 'image/png' })
    await assert.rejects(uploadLessonImage({
        lessonId: 'lesson-1', file: validFile, apiBaseUrl: 'https://api', getAccessToken: async () => 'token',
        fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
    }), /Không thể xin quyền tải ảnh/)

    let call = 0
    await assert.rejects(uploadLessonImage({
        lessonId: 'lesson-1', file: validFile, apiBaseUrl: 'https://api', getAccessToken: async () => 'token',
        fetchImpl: async () => ++call === 1
            ? { ok: true, json: async () => ({ data: { mediaId: 'media-2', uploadUrl: 'https://s3/upload', requiredHeaders: {} } }) }
            : { ok: false, status: 500 },
    }), /Tải ảnh lên thất bại/)
})

test('toolbar inserts only after upload succeeds and exposes a recoverable error state', async () => {
    const toolbar = await readFile(new URL('../components/rich-text-toolbar.tsx', import.meta.url), 'utf8')
    const uploadPosition = toolbar.indexOf('await uploadLessonImage(')
    const insertPosition = toolbar.indexOf("insertContent({", uploadPosition)
    const errorPosition = toolbar.indexOf('setImageError(', insertPosition)
    assert.ok(uploadPosition >= 0 && insertPosition > uploadPosition)
    assert.ok(errorPosition > insertPosition)
    assert.match(toolbar, /role="alert"/)
    assert.match(toolbar, /setImageError\(error instanceof Error/)
})

test('resizes oversized images to a 1600px maximum long edge before upload', async () => {
    const bitmapDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap')
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
    let targetCanvas
    Object.defineProperty(globalThis, 'createImageBitmap', {
        configurable: true,
        value: async () => ({ width: 3200, height: 1600, close() {} }),
    })
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            createElement: () => {
                targetCanvas = {
                    getContext: () => ({ drawImage() {} }),
                    toBlob: (callback, type) => callback(new Blob(['optimized'], { type })),
                }
                return targetCanvas
            },
        },
    })

    try {
        const resized = await optimizeLessonImage(new File(['original'], 'large.png', { type: 'image/png' }))
        assert.equal(targetCanvas.width, 1600)
        assert.equal(targetCanvas.height, 800)
        assert.equal(resized.type, 'image/png')
        assert.equal(resized.size, 9)
    } finally {
        if (bitmapDescriptor) Object.defineProperty(globalThis, 'createImageBitmap', bitmapDescriptor)
        else delete globalThis.createImageBitmap
        if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor)
        else delete globalThis.document
    }
})
