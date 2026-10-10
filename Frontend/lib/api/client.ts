import { ApiError } from './errors.ts'

export type ApiRequestInit = Omit<RequestInit, 'body'> & { body?: unknown }

export type ApiClientOptions = {
    baseUrl: string
    getAccessToken: () => Promise<string>
    onUnauthorized: () => void
    fetchImpl?: typeof fetch
}

export type ApiClient = {
    request<T>(path: string, init?: ApiRequestInit): Promise<T>
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requestIdFrom(payload: unknown): string | undefined {
    if (!isRecord(payload) || !isRecord(payload.meta)) return undefined
    return typeof payload.meta.requestId === 'string' ? payload.meta.requestId : undefined
}

function fallbackForStatus(status: number): { code: string; message: string } {
    switch (status) {
        case 400: return { code: 'VALIDATION_ERROR', message: 'Dữ liệu gửi lên chưa hợp lệ.' }
        case 401: return { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập đã hết hạn.' }
        case 403: return { code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này.' }
        case 404: return { code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu yêu cầu.' }
        case 409: return { code: 'VERSION_CONFLICT', message: 'Dữ liệu đã thay đổi. Hãy tải lại.' }
        default: return { code: 'INTERNAL_ERROR', message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' }
    }
}

async function readJson(response: Response): Promise<unknown | null> {
    try {
        const text = await response.text()
        return text ? JSON.parse(text) : null
    } catch {
        return null
    }
}

export function createApiClient(options: ApiClientOptions): ApiClient {
    const baseUrl = options.baseUrl.replace(/\/+$/, '')
    const fetchImpl = options.fetchImpl ?? fetch

    return {
        async request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
            const accessToken = await options.getAccessToken()
            const headers = new Headers(init.headers)
            headers.set('Authorization', `Bearer ${accessToken}`)

            const { body, ...requestInit } = init
            let serializedBody: string | undefined
            if (body !== undefined) {
                headers.set('Content-Type', 'application/json')
                serializedBody = JSON.stringify(body)
            }

            let response: Response
            try {
                response = await fetchImpl(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
                    ...requestInit,
                    headers,
                    body: serializedBody,
                })
            } catch {
                throw new ApiError({
                    code: 'NETWORK_ERROR',
                    message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
                })
            }

            if (response.status === 204) return undefined as T

            const payload = await readJson(response)
            if (response.ok) {
                if (!isRecord(payload) || !Object.hasOwn(payload, 'data')) {
                    throw new ApiError({
                        code: 'INVALID_RESPONSE',
                        message: 'Máy chủ trả về dữ liệu không hợp lệ.',
                        status: response.status,
                        requestId: requestIdFrom(payload),
                    })
                }
                return payload.data as T
            }

            if (response.status === 401) options.onUnauthorized()

            const fallback = fallbackForStatus(response.status)
            const errorPayload = isRecord(payload) && isRecord(payload.error) ? payload.error : null
            throw new ApiError({
                code: errorPayload && typeof errorPayload.code === 'string' ? errorPayload.code : fallback.code,
                message: errorPayload && typeof errorPayload.message === 'string' ? errorPayload.message : fallback.message,
                status: response.status,
                details: errorPayload?.details,
                requestId: requestIdFrom(payload),
            })
        },
    }
}
