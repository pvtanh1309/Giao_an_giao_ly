import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const config = Object.fromEntries((await readFile(path.join(root, 'Frontend/.env.local'), 'utf8')).split(/\r?\n/)
    .filter((line) => line.startsWith('NEXT_PUBLIC_')).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const usersBase = config.NEXT_PUBLIC_USERS_API_URL.replace(/\/$/, '')
const apiBase = config.NEXT_PUBLIC_CONTENT_API_URL.replace(/\/$/, '')
const clientId = config.NEXT_PUBLIC_COGNITO_CLIENT_ID
assert.ok(apiBase && clientId)
const pythonPath = process.env.CONTENT_TEST_PYTHON ?? path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
const python = spawn(pythonPath, [path.join(root, 'Frontend/tests/browser/personal_backend.py')], { windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', AWS_EC2_METADATA_DISABLED: 'true' } })
const backendPending = new Map()
let seq = 0, failNextSave = false, completeImageUpload
const apiCalls = []
createInterface({ input: python.stdout }).on('line', (line) => { const result = JSON.parse(line); backendPending.get(result.id)?.(result); backendPending.delete(result.id) })
python.stderr.on('data', (data) => process.stderr.write(data))
const backend = (request) => new Promise((resolve) => { const id = ++seq; backendPending.set(id, resolve); python.stdin.write(JSON.stringify({ id, ...request }) + '\n') })
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const server = createServer(async (req, res) => {
    if (req.url === '/probe-image-upload') {
        completeImageUpload = () => { res.writeHead(200); res.end('') }
        req.resume()
        return
    }
    try {
        let file = decodeURIComponent(new URL(req.url, 'http://local').pathname)
        if (file === '/') file = '/index.html'
        if (!path.extname(file)) file += '.html'
        const body = await readFile(path.join(root, 'Frontend/out', file))
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' }); res.end(body)
    } catch { res.writeHead(404); res.end('Not found') }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const profile = await mkdtemp(path.join(tmpdir(), 'giaoan-ui-'))
const chrome = spawn(process.env.CONTENT_TEST_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket
try {
    let port
    for (let i = 0; i < 100; i++) { try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch { await new Promise((r) => setTimeout(r, 100)) } }
    assert.ok(port, 'Chrome debugging port')
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
    socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
    const pending = new Map()
    let commandId = 0
    const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++commandId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
    socket.addEventListener('message', async ({ data }) => {
        const message = JSON.parse(data)
        if (message.id) { const entry = pending.get(message.id); pending.delete(message.id); message.error ? entry?.reject(new Error(JSON.stringify(message.error))) : entry?.resolve(message.result); return }
        if (message.method !== 'Fetch.requestPaused') return
        const { requestId, request } = message.params
        try {
            if (request.url.startsWith(origin)) { await command('Fetch.continueRequest', { requestId }); return }
            if ((request.url.startsWith(apiBase) || request.url.startsWith(usersBase))) {
                const relative = request.url.slice((request.url.startsWith(apiBase) ? apiBase : usersBase).length)
                apiCalls.push([request.method, relative])
                let result
                if (request.method === 'OPTIONS') result = { status: 204, body: null }
                else if (relative.endsWith('/media-upload-url')) result = { status: 200, body: { data: { mediaId: 'media_probe', uploadUrl: origin + '/probe-image-upload' } } }
                else if (failNextSave && ['POST', 'PUT'].includes(request.method)) { failNextSave = false; result = { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Local conflict probe' } } } }
                else { const claims = JSON.parse(Buffer.from((request.headers.Authorization || request.headers.authorization).split('.')[1], 'base64url').toString()); result = await backend({ url: relative, method: request.method, sub: claims.sub, role: claims['cognito:groups'][0], body: request.postData ? JSON.parse(request.postData) : {} }) }
                await command('Fetch.fulfillRequest', { requestId, responseCode: result.status, responseHeaders: [
                    { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
                    { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
                    { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
                ], body: result.body ? Buffer.from(JSON.stringify(result.body)).toString('base64') : '' })
            } else await command('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
        } catch (error) { process.stderr.write(`Probe network error: ${error.message}\n`) }
    })
    await command('Page.enable'); await command('Runtime.enable'); await command('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
    const token = (claims) => `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.local-probe`
    const seed = (role) => {
        const claims = { sub: 'local-ui-' + role, email: 'local@example.test', 'cognito:groups': [role === 'other' ? 'reader' : role], iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 }
        return `localStorage.clear();localStorage.setItem(${JSON.stringify(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)},'local-ui-editor');` +
            Object.entries({ accessToken: token({ ...claims, token_use: 'access', client_id: clientId }), idToken: token({ ...claims, token_use: 'id', aud: clientId }), refreshToken: 'local-only', clockDrift: '0' }).map(([key, value]) => `localStorage.setItem(${JSON.stringify(`CognitoIdentityServiceProvider.${clientId}.local-ui-editor.${key}`)},${JSON.stringify(value)});`).join('')
    }
    let injection = await command('Page.addScriptToEvaluateOnNewDocument', { source: seed('reader') })
    const evaluate = async (expression) => {
        const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
        return result.result.value
    }
    const wait = async (expression) => {
        for (let i = 0; i < 150; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise((r) => setTimeout(r, 100)) }
        throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`)
    }
    const click = (text, selector = 'button') => evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button');e.click()})()`)
    const fill = (selector, text) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(text)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    const navigate = async (pathname) => { await command('Page.navigate', { url: origin + pathname }); await wait("!document.body.innerText.includes('Đang tải thư viện') && document.querySelector('button') && !document.querySelector('.auth-screen')") }


    await navigate('/lesson-plans')
    await wait("document.querySelector('.account-menu-trigger')?.innerText.includes('Maria Lan')")
    await evaluate("document.querySelector('.account-menu-trigger').click()")
    await click('Cập nhật thông tin')
    await wait("document.querySelector('.personal-profile-dialog input[type=email]')")
    await fill('.personal-profile-dialog input[type=email]', 'new-contact@example.test')
    await click('Lưu thông tin')
    await wait("!document.querySelector('.personal-profile-dialog')")
    await evaluate("document.querySelector('.account-menu-trigger').click()")
    await click('Cập nhật thông tin')
    await wait("document.querySelector('.personal-profile-dialog input[type=email]')?.value==='new-contact@example.test'")
    assert.equal(await evaluate("document.querySelector('.personal-profile-dialog input[readonly]').value"), 'local-ui-reader@example.test')
    await click('Hủy')
    console.log('PASS contact profile persists and login email is unchanged')
    await fill('input[aria-label="Tìm giáo án"]', 'Giáo án ghi chú riêng')
    await wait("document.querySelector('.lesson-search-result')")
    await evaluate("[...document.querySelectorAll('button')].find(e=>e.innerText.includes('Giáo án ghi chú riêng'))?.click()")
    await wait("document.querySelector('.lesson-reading-page h1')")
    await wait("document.querySelector('.personal-notes-panel') && !document.querySelector('.personal-notes-panel').innerText.includes('Đang tải')")
    const url = await evaluate('location.pathname+location.search')
    const selectEmoji = async () => {
        await evaluate(`(()=>{const e=document.querySelector('[aria-label="Ý chính"]');e.focus();const highlighted=e.querySelector('.private-note-highlight');const t=highlighted?.firstChild||e.querySelector('p').firstChild;const r=document.createRange();r.setStart(t,highlighted?0:1);r.setEnd(t,highlighted?2:3);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))})()`)
        await wait("!document.querySelector('.personal-notes-panel .primary-button').disabled")
    }
    await selectEmoji()
    await click('Thêm ghi chú cho đoạn đã chọn')
    await wait("document.querySelector('#note-dialog-title')")
    assert.equal(await evaluate("document.querySelector('.personal-profile-dialog blockquote').innerText"), '😀')
    const fillNote = (value) => evaluate(`(()=>{const e=document.querySelector('.personal-profile-dialog textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await fillNote('Ghi chú cá nhân về emoji')
    await click('Lưu ghi chú')
    await wait("document.querySelector('.private-note-highlight')?.textContent==='😀'")
    await command('Page.reload')
    await wait("document.querySelector('.private-note-highlight')?.textContent==='😀'")
    await evaluate("document.querySelector('.personal-notes-panel details').open=true")
    await wait("document.querySelector('.personal-notes-panel li')")
    assert.ok((await evaluate("document.querySelector('.personal-notes-panel li').innerText")).includes('Ghi chú cá nhân về emoji'))
    await evaluate("document.querySelector('.personal-notes-panel li button').click()")
    await wait("document.querySelector('.personal-profile-dialog textarea')")
    await fillNote('Ghi chú đã sửa')
    await click('Lưu ghi chú')
    await wait("!document.querySelector('.personal-profile-dialog')")
    console.log('PASS emoji selection, private highlight, reload and edit')
    await evaluate(`(()=>{const first=document.querySelector('[aria-label="Lời Chúa"] p').firstChild;const last=document.querySelector('[aria-label="Ý chính"] p').firstChild;const r=document.createRange();r.setStart(first,0);r.setEnd(last,1);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))})()`)
    await wait("document.querySelector('.personal-notes-panel .primary-button').disabled && document.querySelector('.personal-notes-panel').innerText.includes('Chỉ chọn chữ')")
    console.log('PASS cross-field selection clears pending anchor')
    await evaluate("document.querySelector('.personal-notes-panel li button').click()")
    await wait("document.querySelector('.personal-profile-dialog textarea')")
    await fillNote('Unsaved note remains after Back')
    let dialogs = 0, acceptDialog = false
    const backDialogHandler = async ({data}) => {const message=JSON.parse(data);if(message.method==='Page.javascriptDialogOpening'){dialogs++;await command('Page.handleJavaScriptDialog',{accept:acceptDialog})}}
    socket.addEventListener('message',backDialogHandler)
    await evaluate('history.back()')
    for(let i=0;i<50 && !dialogs;i++)await new Promise((r)=>setTimeout(r,100))
    assert.equal(dialogs,1)
    await wait(`location.pathname+location.search===${JSON.stringify(url)}`)
    assert.equal(await evaluate("document.querySelector('.personal-profile-dialog textarea').value"),'Unsaved note remains after Back')
    acceptDialog=true
    await click('Đóng', '.personal-profile-dialog button')
    await wait("!document.querySelector('.personal-profile-dialog')")
    socket.removeEventListener('message',backDialogHandler)
    console.log('PASS cancelling browser Back preserves dirty note and history position')
    await command('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true})
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true)
    await selectEmoji()
    console.log('PASS mobile layout and text selection')
    await command('Emulation.clearDeviceMetricsOverride')
    await command('Page.removeScriptToEvaluateOnNewDocument', {identifier:injection.identifier})
    injection = await command('Page.addScriptToEvaluateOnNewDocument',{source:seed('other')})
    await navigate(url)
    await wait("document.querySelector('.account-menu-trigger')?.innerText.includes('Giuse Minh')")
    await wait("document.querySelector('.personal-notes-panel') && !document.querySelector('.personal-notes-panel').innerText.includes('Đang tải')")
    assert.equal(await evaluate("document.querySelectorAll('.private-note-highlight').length"),0)
    assert.equal(await evaluate("document.querySelector('.personal-notes-panel summary').innerText"),'Danh sách ghi chú (0)')
    console.log('PASS second personal account cannot see first account notes')
    await command('Page.removeScriptToEvaluateOnNewDocument', {identifier:injection.identifier})
    injection = await command('Page.addScriptToEvaluateOnNewDocument',{source:seed('reader')})
    await navigate(url)
    await wait("document.querySelector('.private-note-highlight')")
    await evaluate("document.querySelector('.personal-notes-panel details').open=true;document.querySelector('.personal-notes-panel li button').click()")
    await wait("document.querySelector('.personal-profile-dialog textarea')")
    await command('Page.handleJavaScriptDialog', {accept:true}).catch(()=>{})
    const dialogHandler = async ({data}) => {const m=JSON.parse(data);if(m.method==='Page.javascriptDialogOpening')await command('Page.handleJavaScriptDialog',{accept:true})}
    socket.addEventListener('message', dialogHandler)
    await click('Xóa', '.personal-profile-dialog button')
    await wait("!document.querySelector('.private-note-highlight') && !document.querySelector('.personal-profile-dialog')")
    socket.removeEventListener('message',dialogHandler)
    console.log('PASS private note delete; all requests intercepted, no live AWS')
} finally {
    socket?.close(); chrome.kill(); python.kill(); server.closeAllConnections(); server.close()
}
