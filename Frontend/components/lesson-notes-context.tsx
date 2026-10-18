'use client'
import { createContext, useContext } from 'react'
import type { LessonNote } from '../lib/api/lesson-notes'
import type { LessonNoteAnchor } from '../lib/lesson-note-anchors'
export type LessonNotesValue = {
    notes: LessonNote[]
    select: (fieldId: string, text: string, start: number, end: number) => void
    rejectSelection: () => void
    open: (noteId: string) => void
    report: (fieldId: string, resolvedIds: string[]) => void
    anchor: LessonNoteAnchor | null
}
export const LessonNotesContext = createContext<LessonNotesValue | null>(null)
export const useLessonNotes = () => useContext(LessonNotesContext)
