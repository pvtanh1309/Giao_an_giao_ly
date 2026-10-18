import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
export const lessonNotesKey = new PluginKey<DecorationSet>('privateLessonNotes')
export const LessonNotesDecorations = Extension.create({
    name: 'privateLessonNotes',
    addProseMirrorPlugins() {
        return [new Plugin({
            key: lessonNotesKey,
            state: {
                init: () => DecorationSet.empty,
                apply(tr, previous) {
                    const ranges = tr.getMeta(lessonNotesKey) as { from: number; to: number; noteId: string }[] | undefined
                    return ranges ? DecorationSet.create(tr.doc, ranges.filter((r) => r.from < r.to).map((r) => Decoration.inline(r.from, r.to, { class: 'private-note-highlight', 'data-private-note': r.noteId }))) : previous.map(tr.mapping, tr.doc)
                },
            },
            props: { decorations: (state) => lessonNotesKey.getState(state) },
        })]
    },
})
