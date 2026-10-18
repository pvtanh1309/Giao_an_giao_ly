import assert from 'node:assert/strict'
import test from 'node:test'
import { createApiClient } from '../lib/api/client.ts'
import { getAccessTokenAuthSession, invalidateCurrentAuthSession } from '../lib/auth/state.ts'
test('delayed A 401 cannot sign out B or discard B draft', async () => {
    let version=1, state={sub:'A',draft:''}, release, signouts=0
    const client={signOut(){signouts++}}
    const current=()=>version===1
    const dispatch=()=>{state={sub:null,draft:''}}
    const api=createApiClient({baseUrl:'https://local.test',getAccessToken:async()=> 'A',onUnauthorized:()=>invalidateCurrentAuthSession(client,dispatch,current),fetchImpl:()=>new Promise((resolve)=>{release=resolve})})
    const result=api.request('/me').catch((error)=>error.status)
    await new Promise((resolve)=>setImmediate(resolve))
    version=2; state={sub:'B',draft:'Unsaved B note'}
    release(new Response('{}',{status:401}))
    assert.equal(await result,401); assert.equal(signouts,0)
    assert.deepEqual(state,{sub:'B',draft:'Unsaved B note'})
})
test('delayed A token acquisition failure does not invalidate B', async () => {
    let version=1, reject, signouts=0, actions=[]
    const result=getAccessTokenAuthSession({getAccessToken:()=>new Promise((_, fail)=>{reject=fail}),signOut:()=>signouts++},(a)=>actions.push(a),()=>version===1)
    version=2; reject(new Error('Expired A'))
    await assert.rejects(result)
    assert.equal(signouts,0); assert.deepEqual(actions,[])
})
