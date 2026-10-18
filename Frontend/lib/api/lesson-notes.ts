import type { ApiClient } from './client'
import type { LessonNoteAnchor } from '../lesson-note-anchors'
export type LessonNote = { noteId: string; lessonId: string; body: string; anchor: LessonNoteAnchor; version: number; createdAt: string; updatedAt: string }
export function createLessonNotesApi(api: ApiClient) {
    const path = (lessonId: string, noteId?: string) => `/me/lessons/${encodeURIComponent(lessonId)}/notes${noteId ? '/' + encodeURIComponent(noteId) : ''}`
    return {
        list: (id: string) => api.request<LessonNote[]>(path(id)),
        create: (id: string, fields: Pick<LessonNote, 'noteId' | 'anchor' | 'body'>) => api.request<LessonNote>(path(id), { method: 'POST', body: fields }),
        update: (id: string, noteId: string, body: string, version: number) => api.request<LessonNote>(path(id, noteId), { method: 'PUT', body: { body, version } }),
        remove: (id: string, noteId: string, version: number) => api.request(path(id, noteId), { method: 'DELETE', body: { version } }),
    }
}
