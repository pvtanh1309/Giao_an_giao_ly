import test from 'node:test'
import assert from 'node:assert/strict'
import { createLessonNotesApi } from '../lib/api/lesson-notes.ts'
test('private notes never send an owner and preserve versions and retry IDs', async () => {
 const calls = []; const api = createLessonNotesApi({request: async (...args) => {calls.push(args); return []}})
 await api.list('lesson_a'); await api.create('lesson_a', {noteId:'id', anchor:{}, body:'note'})
 await api.update('lesson_a','id','changed',2); await api.remove('lesson_a','id',3)
 assert.deepEqual(calls.map(x => x[0]), ['/me/lessons/lesson_a/notes','/me/lessons/lesson_a/notes','/me/lessons/lesson_a/notes/id','/me/lessons/lesson_a/notes/id'])
 assert.deepEqual(calls[2][1].body, {body:'changed',version:2})
 assert.deepEqual(calls[3][1].body, {version:3})
})
