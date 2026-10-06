import type { JSONContent } from '@tiptap/react'

export const maxLessonImageBytes = 5 * 1024 * 1024
export const lessonImageWidths = [140, 220, 320] as const
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function clampLessonImageWidth(width: number | undefined | null): number {
    if (!Number.isFinite(width)) return 220
    return lessonImageWidths.reduce((closest, candidate) =>
        Math.abs(candidate - Number(width)) < Math.abs(closest - Number(width)) ? candidate : closest,
    220)
}

export type LessonImageValidation = { ok: true } | { ok: false; reason: string }

export function validateLessonImage(file: Pick<File, 'type' | 'size'>): LessonImageValidation {
    if (!acceptedImageTypes.has(file.type)) {
        return { ok: false, reason: 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.' }
    }
    if (file.size > maxLessonImageBytes) {
        return { ok: false, reason: 'Ảnh phải có dung lượng không quá 5 MiB.' }
    }
    return { ok: true }
}

export async function optimizeLessonImage(file: File): Promise<File> {
    if (typeof createImageBitmap !== 'function') return file

    const image = await createImageBitmap(file)
    const longestEdge = Math.max(image.width, image.height)
    if (longestEdge <= 1600) {
        image.close()
        return file
    }

    const scale = 1600 / longestEdge
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
        image.close()
        return file
    }
    context.drawImage(image, 0, 0, width, height)
    image.close()

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, file.type === 'image/jpeg' ? 0.86 : undefined))
    return blob ? new File([blob], file.name, { type: file.type, lastModified: file.lastModified }) : file
}

export function stripRuntimeImageUrls(document: JSONContent): JSONContent {
    const clean = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(clean)
        if (!value || typeof value !== 'object') return value

        const item = value as Record<string, unknown>
        const result: Record<string, unknown> = {}
        for (const [key, child] of Object.entries(item)) {
            if (item.type === 'image' && key === 'attrs' && child && typeof child === 'object') {
                const attrs = { ...(child as Record<string, unknown>) }
                delete attrs.src
                result[key] = clean(attrs)
            } else {
                result[key] = clean(child)
            }
        }
        return result
    }

    return clean(document) as JSONContent
}

type UploadUrlResponse = {
    mediaId: string
    uploadUrl: string
    requiredHeaders?: Record<string, string>
}

export async function uploadLessonImage({
    lessonId,
    file,
    apiBaseUrl,
    getAccessToken,
    fetchImpl = fetch,
}: {
    lessonId: string
    file: File
    apiBaseUrl: string
    getAccessToken?: () => Promise<string>
    fetchImpl?: typeof fetch
}): Promise<{ mediaId: string; previewSrc: string }> {
    const validation = validateLessonImage(file)
    if (!validation.ok) throw new Error(validation.reason)
    if (!apiBaseUrl.trim()) throw new Error('Chưa cấu hình địa chỉ content API để tải ảnh lên.')
    if (!getAccessToken) throw new Error('Chưa cấu hình đăng nhập Cognito; hiện chưa thể tải ảnh lên.')

    const accessToken = await getAccessToken()
    if (!accessToken) throw new Error('Phiên đăng nhập chưa sẵn sàng; hãy đăng nhập lại rồi thử tiếp.')
    const endpoint = `${apiBaseUrl.replace(/\/+$/, '')}/manage/lessons/${encodeURIComponent(lessonId)}/media-upload-url`
    let uploadFile: File
    try {
        uploadFile = await optimizeLessonImage(file)
    } catch {
        throw new Error('Không thể đọc hoặc tối ưu ảnh này. Hãy thử ảnh JPEG, PNG hoặc WebP khác.')
    }
    const optimizedValidation = validateLessonImage(uploadFile)
    if (!optimizedValidation.ok) throw new Error(optimizedValidation.reason)
    let signResponse: Response
    try {
        signResponse = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ mimeType: uploadFile.type, sizeBytes: uploadFile.size }),
        })
    } catch {
        throw new Error('Không thể kết nối để xin quyền tải ảnh. Hãy kiểm tra mạng rồi thử lại.')
    }
    if (!signResponse.ok) throw new Error('Không thể xin quyền tải ảnh. Hãy thử lại sau.')

    let responseBody: { data?: UploadUrlResponse } & Partial<UploadUrlResponse>
    try {
        responseBody = await signResponse.json() as { data?: UploadUrlResponse } & Partial<UploadUrlResponse>
    } catch {
        throw new Error('Phản hồi cấp quyền tải ảnh không hợp lệ.')
    }
    const signed = responseBody.data ?? responseBody as UploadUrlResponse
    if (!signed.mediaId || !signed.uploadUrl) throw new Error('Phản hồi cấp quyền tải ảnh còn thiếu thông tin.')

    let uploadResponse: Response
    try {
        uploadResponse = await fetchImpl(signed.uploadUrl, {
            method: 'PUT',
            headers: signed.requiredHeaders ?? { 'Content-Type': uploadFile.type },
            body: uploadFile,
        })
    } catch {
        throw new Error('Không thể tải ảnh lên kho lưu trữ. Hãy thử lại.')
    }
    if (!uploadResponse.ok) throw new Error('Tải ảnh lên thất bại. Hãy thử lại.')

    return { mediaId: signed.mediaId, previewSrc: URL.createObjectURL(uploadFile) }
}
