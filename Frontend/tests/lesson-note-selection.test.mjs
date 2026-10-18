import test from 'node:test'
import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { lessonTextMap, selectedNoteRange, selectionIsWithinField } from '../lib/lesson-note-selection.ts'
const schema = new Schema({nodes:{doc:{content:'block*'},paragraph:{group:'block',content:'inline*'},text:{group:'inline'},hardBreak:{inline:true,group:'inline'},image:{inline:true,group:'inline'},table:{group:'block',content:'row*'},row:{content:'cell*'},cell:{content:'paragraph*'}}})
test('cross-field selection is rejected even when old ProseMirror selection exists', () => {
 const a={}, b={}; const field={contains:(node)=>node===a}
 assert.equal(selectionIsWithinField(field,{anchorNode:a,focusNode:b}),false)
 assert.equal(selectionIsWithinField(field,{anchorNode:a,focusNode:a}),true)
})
test('maps emoji and breaks from code points to ProseMirror UTF16 positions', () => {
 const doc = schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A😀B'},{type:'hardBreak'},{type:'text',text:'Việt'}]},{type:'paragraph',content:[{type:'text',text:'Nam'}]}]})
 const map = lessonTextMap(doc)
 assert.equal(map.text,'A😀B\nViệt\nNam')
 assert.deepEqual(map.units[1],{from:2,to:4})
 assert.deepEqual(selectedNoteRange(map,2,4),{start:1,end:2})
})
test('table cells use the same canonical separators as backend', () => {
 const doc = schema.nodeFromJSON({type:'doc',content:[{type:'table',content:[{type:'row',content:[{type:'cell',content:[{type:'paragraph',content:[{type:'text',text:'A'}]}]},{type:'cell',content:[{type:'paragraph',content:[{type:'text',text:'B'}]}]}]}]}]})
 assert.equal(lessonTextMap(doc).text,'A\nB')
})
