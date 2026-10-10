export type ApiErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VERSION_CONFLICT'
    | 'VALIDATION_ERROR'
    | 'NETWORK_ERROR'
    | 'INVALID_RESPONSE'
    | 'INTERNAL_ERROR'
    | string

export class ApiError extends Error {
    readonly code: ApiErrorCode
    readonly status: number
    readonly details: unknown
    readonly requestId?: string

    constructor(options: {
        code: ApiErrorCode
        message: string
        status?: number
        details?: unknown
        requestId?: string
    }) {
        super(options.message)
        this.name = 'ApiError'
        this.code = options.code
        this.status = options.status ?? 0
        this.details = options.details
        this.requestId = options.requestId
    }
}
