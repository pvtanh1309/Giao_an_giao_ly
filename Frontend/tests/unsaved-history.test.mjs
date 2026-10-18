import test from 'node:test'
import assert from 'node:assert/strict'
import { guardHistoryNavigation } from '../lib/unsaved-work.ts'
test('Back cancellation restores history without unmounting dirty form; accepted Back synchronizes view', () => {
 const listeners = {}; const stack=[{}]; let pos=0; let changes=0; let allowed=false
 const history={get state(){return stack[pos]},replaceState(s){stack[pos]=s},pushState(s){stack.splice(++pos);stack[pos]=s},go(delta){pos+=delta;listeners.popstate({state:stack[pos]})}}
 const window={history,addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:(key)=>delete listeners[key]}
 const cleanup=guardHistoryNavigation(()=>changes++,()=>allowed,window)
 history.pushState({},'', '/lesson'); history.go(-1)
 assert.equal(pos,1); assert.equal(changes,0)
 allowed=true; history.go(-1); assert.equal(pos,0); assert.equal(changes,1)
 cleanup(); assert.equal(listeners.popstate,undefined)
})
