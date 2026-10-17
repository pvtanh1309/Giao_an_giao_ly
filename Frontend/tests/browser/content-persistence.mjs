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
const apiBase = config.NEXT_PUBLIC_CONTENT_API_URL.replace(/\/$/, '')
const clientId = config.NEXT_PUBLIC_COGNITO_CLIENT_ID
assert.ok(apiBase && clientId)
const pythonPath = process.env.CONTENT_TEST_PYTHON ?? path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python')
const python = spawn(pythonPath, [path.join(root, 'Frontend/tests/browser/content_backend.py')], { windowsHide: true,
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
            if (request.url.startsWith(apiBase)) {
                const relative = request.url.slice(apiBase.length)
                apiCalls.push([request.method, relative])
                let result
                if (request.method === 'OPTIONS') result = { status: 204, body: null }
                else if (relative.endsWith('/media-upload-url')) result = { status: 200, body: { data: { mediaId: 'media_probe', uploadUrl: origin + '/probe-image-upload' } } }
                else if (failNextSave && ['POST', 'PUT'].includes(request.method)) { failNextSave = false; result = { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Local conflict probe' } } } }
                else result = await backend({ url: relative, method: request.method, body: request.postData ? JSON.parse(request.postData) : {} })
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
        const claims = { sub: 'local-ui-editor', email: 'local@example.test', 'cognito:groups': [role], iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 }
        return `localStorage.clear();localStorage.setItem(${JSON.stringify(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)},'local-ui-editor');` +
            Object.entries({ accessToken: token({ ...claims, token_use: 'access', client_id: clientId }), idToken: token({ ...claims, token_use: 'id', aud: clientId }), refreshToken: 'local-only', clockDrift: '0' }).map(([key, value]) => `localStorage.setItem(${JSON.stringify(`CognitoIdentityServiceProvider.${clientId}.local-ui-editor.${key}`)},${JSON.stringify(value)});`).join('')
    }
    const injection = await command('Page.addScriptToEvaluateOnNewDocument', { source: seed('admin') })
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

    const checkStickyToolbar = async (editorSelector, scrollSelector) => {
        await evaluate(`document.querySelector(${JSON.stringify(editorSelector)}).focus()`)
        await command('Input.insertText', { text: Array.from({ length: 80 }, (_, i) => `Nội dung dài dòng ${i + 1}`).join('\n') })
        await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(editorSelector)}).closest('.rich-text-editor');
            const s=${scrollSelector ? `document.querySelector(${JSON.stringify(scrollSelector)})` : 'null'};
            if(s)s.scrollTop+=e.getBoundingClientRect().top-s.getBoundingClientRect().top+450;
            else window.scrollTo({top:window.scrollY+e.getBoundingClientRect().top+450,behavior:'instant'})})()`)
        await new Promise((resolve) => setTimeout(resolve, 100))
        const geometry = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(editorSelector)}).closest('.rich-text-editor');
            const toolbar=e.querySelector('.rich-text-toolbar').getBoundingClientRect();
            const s=${scrollSelector ? `document.querySelector(${JSON.stringify(scrollSelector)})` : 'null'};
            const top=s?s.getBoundingClientRect().top+parseFloat(getComputedStyle(s).borderTopWidth)+parseFloat(getComputedStyle(s).paddingTop):document.querySelector('.topbar').getBoundingClientRect().bottom;
            return {toolbarTop:toolbar.top,toolbarBottom:toolbar.bottom,expectedTop:top,editorBottom:e.getBoundingClientRect().bottom}})()`)
        assert.ok(geometry.toolbarTop >= geometry.expectedTop - 2 && geometry.toolbarTop <= geometry.expectedTop + 2,
            `toolbar remains visible at its scroll boundary: ${JSON.stringify(geometry)}`)
        assert.ok(geometry.editorBottom > geometry.toolbarBottom + 100)
    }

    await navigate('/lesson-plans')
    await wait("[...document.querySelectorAll('button')].some(e=>e.textContent.includes('Thêm giáo án'))")
    await click('Thêm giáo án')
    await fill('.admin-editor-modal input', 'Giáo án kiểm tra lưu thật')
    await wait("document.querySelector('.admin-editor-modal [aria-label=\"Ý chính\"]')")
    await checkStickyToolbar('.admin-editor-modal [aria-label="Ý chính"]', '.admin-editor-modal-lesson')
    await evaluate("(()=>{const e=document.querySelector('.admin-editor-modal [aria-label=\"Ý chính\"]');e.focus();const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r)})()")
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
    console.log('PASS toolbar follows scrolling inside the lesson dialog')
    await click('Lưu nháp', '.admin-editor-modal button')
    await wait("document.querySelector('.lesson-reading-page h1')?.textContent==='Giáo án kiểm tra lưu thật'")
    const lessonUrl = await evaluate('location.pathname+location.search')
    await command('Page.reload'); await wait("document.querySelector('.lesson-reading-page h1')?.textContent==='Giáo án kiểm tra lưu thật'")
    await click('Chỉnh sửa trực tiếp')
    await wait("document.querySelector('.lesson-reading-page input[type=file]')")
    await checkStickyToolbar('.lesson-reading-page [aria-label="Ý chính"]')
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await checkStickyToolbar('.lesson-reading-page [aria-label="Ý chính"]')
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
    assert.equal(await evaluate("document.querySelector('.lesson-reading-page [aria-label=\"Ý chính\"]').closest('.rich-text-editor').querySelector('.rich-text-toolbar').getBoundingClientRect().height <= 80"), true)
    assert.equal(await evaluate("(()=>{const t=document.querySelector('.lesson-reading-page [aria-label=\"Ý chính\"]').closest('.rich-text-editor').querySelector('.rich-text-toolbar');t.scrollLeft=200;return t.scrollLeft>0})()"), true)
    await evaluate("document.querySelector('.lesson-reading-page [aria-label=\"Tâm tình\"]').scrollIntoView({block:'start',behavior:'instant'})")
    assert.equal(await evaluate("document.querySelector('.lesson-reading-page [aria-label=\"Ý chính\"]').closest('.rich-text-editor').querySelector('.rich-text-toolbar').getBoundingClientRect().bottom <= document.querySelector('.topbar').getBoundingClientRect().bottom+2"), true)
    await command('Emulation.clearDeviceMetricsOverride')
    await click('Hủy', '.lesson-reading-page button')
    await click('Chỉnh sửa trực tiếp')
    console.log('PASS toolbar stays below the header on desktop/mobile and leaves with its editor')
    const selectParagraph = async (index) => {
        await evaluate(`(()=>{const e=document.querySelector('[aria-label="Ý chính"]');e.focus();const p=e.querySelectorAll('p')[${index}];const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r)})()`)
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
    const setSize = (size) => evaluate(`(()=>{const e=document.querySelector('[aria-label="Ý chính"]').closest('.rich-text-editor').querySelector('select[aria-label="Cỡ chữ"]');e.value=${JSON.stringify(size)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
    const editorFailures = []
    await evaluate("document.querySelector('[aria-label=\"Ý chính\"]').focus()")
    await command('Input.insertText', { text: 'Dòng thứ nhất' })
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await command('Input.insertText', { text: 'Dòng thứ hai' })
    await selectParagraph(0)
    await setSize('24px')
    await selectParagraph(1)
    const displayedSize = await evaluate("document.querySelector('[aria-label=\"Ý chính\"]').closest('.rich-text-editor').querySelector('select[aria-label=\"Cỡ chữ\"]').value")
    if (displayedSize !== '') editorFailures.push(`new plain selection incorrectly shows ${displayedSize}`)
    await setSize('24px')
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Ý chính\"] p:nth-child(2) span').style.fontSize"), '24px')
    await evaluate("document.querySelector('[aria-label=\"Tâm tình\"]').focus()")
    await command('Input.insertText', { text: '1.' })
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
    if (await evaluate("!!document.querySelector('[aria-label=\"Tâm tình\"] ol') || document.querySelector('[aria-label=\"Tâm tình\"]').textContent!=='1. '")) editorFailures.push('typing 1. + Space unexpectedly creates a list')
    for (const marker of ['-', '*', '+']) {
        await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Chuẩn bị\"]');e.focus();const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r)})()")
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
        await command('Input.insertText', { text: marker })
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', text: ' ', windowsVirtualKeyCode: 32 })
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 })
        const actual = await evaluate("({text:document.querySelector('[aria-label=\"Chuẩn bị\"]').textContent,list:!!document.querySelector('[aria-label=\"Chuẩn bị\"] ul')})")
        if (actual.text !== `${marker} ` || actual.list) editorFailures.push(`typing ${marker} + Space unexpectedly creates a list`)
    }
    const defaultColor = await evaluate("getComputedStyle(document.querySelector('[aria-label=\"Tâm tình\"] p')).color")
    if (defaultColor !== 'rgb(0, 0, 0)') editorFailures.push(`default text is ${defaultColor}, expected black`)
    assert.deepEqual(editorFailures, [])
    console.log('PASS font size follows selection; literal numbered/bullet prefixes and default black text')
    await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Tâm tình\"]');e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);e.closest('.rich-text-editor').querySelector('button[aria-label=\"In đậm\"]').click()})()")
    await command('Input.insertText', { text: 'Định dạng' })
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 })
    await command('Input.insertText', { text: 'Xuống dòng' })
    await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Tâm tình\"]');e.focus();const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r)})()")
    await new Promise((resolve) => setTimeout(resolve, 50))
    await evaluate("(()=>{const e=document.querySelector('[aria-label=\"Tâm tình\"]').closest('.rich-text-editor').querySelector('select[aria-label=\"Cỡ chữ\"]');e.value='24px';e.dispatchEvent(new Event('change',{bubbles:true}))})()")
    await click('Lưu nháp', '.lesson-reading-page button')
    await wait("document.querySelector('.lesson-reading-page h1') || document.querySelector('.admin-toast.error')")
    assert.equal(await evaluate("document.querySelector('.admin-toast.error')?.innerText ?? ''"), '', 'formatted Shift+Enter must save without a marks validation error')
    await command('Page.reload')
    await wait("document.querySelector('[aria-label=\"Tâm tình\"]')?.textContent==='1. Định dạngXuống dòng'")
    assert.equal(await evaluate("!!document.querySelector('[aria-label=\"Tâm tình\"] br')"), true)
    console.log('PASS formatted soft line break saves and reloads with its formatting')
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Chuẩn bị\"]').textContent"), '+ ')
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Ý chính\"] p:nth-child(2) span').style.fontSize"), '24px')
    await click('Chỉnh sửa trực tiếp')
    const imageFile = path.join(profile, 'probe.png')
    await writeFile(imageFile, Buffer.from(await evaluate("(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/png').split(',')[1]})()"), 'base64'))
    const documentNode = await command('DOM.getDocument')
    const fileInput = await command('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: '.lesson-reading-page input[type=file]' })
    const previousSaves = apiCalls.filter(([method, url]) => method === 'PUT' && url.endsWith('/draft')).length
    await command('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [imageFile] })
    for (let i = 0; i < 100 && !completeImageUpload; i++) await new Promise((resolve) => setTimeout(resolve, 50))
    assert.ok(completeImageUpload, 'upload reaches the delayed local storage endpoint')
    assert.equal(await evaluate("[...document.querySelectorAll('.lesson-reading-page button')].find(e=>e.textContent.trim()==='Lưu nháp').matches(':disabled')"), true)
    await click('Lưu nháp', '.lesson-reading-page button')
    assert.equal(apiCalls.filter(([method, url]) => method === 'PUT' && url.endsWith('/draft')).length, previousSaves)
    await click('Đăng xuất')
    assert.equal(await evaluate("!!document.querySelector('.lesson-reading-page')"), true)
    completeImageUpload()
    await wait("document.querySelector('img[data-media-id=\"media_probe\"]')")
    await click('Hủy', '.lesson-reading-page button')
    console.log('PASS image upload blocks save until the image is inserted')
    await click('Chỉnh sửa trực tiếp')
    await click('Thêm bước', '.lesson-reading-page button')
    await click('Thêm bước', '.lesson-reading-page button')
    await evaluate("document.querySelector('[aria-label=\"Hoạt động giáo lý viên, bước 1\"]').focus()")
    await command('Input.insertText', { text: 'Hoạt động A' })
    await evaluate("document.querySelector('[aria-label=\"Hoạt động giáo lý viên, bước 2\"]').focus()")
    await command('Input.insertText', { text: 'Hoạt động B' })
    await evaluate("document.querySelector('button[aria-label=\"Xóa bước 1\"]').click()")
    assert.equal(await evaluate("document.querySelector('[aria-label=\"Hoạt động giáo lý viên, bước 1\"]').textContent"), 'Hoạt động B')
    await click('Lưu nháp', '.lesson-reading-page button')
    await wait("!!document.querySelector('.lesson-reading-page h1')")
    await command('Page.reload')
    await wait("document.querySelector('[aria-label=\"Hoạt động giáo lý viên, bước 1\"]')?.textContent==='Hoạt động B'")
    console.log('PASS removing a progression step preserves the next editor content after save/reload')
    await click('Chỉnh sửa trực tiếp')
    await fill('input[aria-label="Tiêu đề bài giáo án"]', 'Nội dung chưa lưu khi API lỗi')
    failNextSave = true
    await click('Lưu nháp', '.lesson-reading-page button')
    await wait("document.body.innerText.includes('Local conflict probe')")
    assert.equal(await evaluate('document.querySelector(\'input[aria-label="Tiêu đề bài giáo án"]\').value'), 'Nội dung chưa lưu khi API lỗi')
    await click('Lưu nháp', '.lesson-reading-page button')
    await wait("document.querySelector('.lesson-reading-page h1')?.textContent==='Nội dung chưa lưu khi API lỗi'")
    await click('Xuất bản', '.lesson-reading-page button')
    await wait("!document.querySelector('.lesson-reading-page')?.innerText.includes('Bản nháp đã lưu')")
    console.log('PASS lesson create, reload, failed-save edit retention, retry and publish')

    await navigate('/programs')
    await wait("[...document.querySelectorAll('button')].some(e=>e.textContent.includes('Thêm chương trình'))")
    await click('Thêm chương trình')
    await fill('.admin-editor-modal input', 'Chương trình kiểm tra lưu thật')
    await click('Lưu nháp', '.admin-editor-modal button')
    await wait("document.querySelector('.program-reading-page h1')?.textContent==='Chương trình kiểm tra lưu thật'")
    await command('Page.reload'); await wait("document.querySelector('.program-reading-page h1')?.textContent==='Chương trình kiểm tra lưu thật'")
    await click('Xuất bản', '.program-reading-page button')
    await wait("!document.querySelector('.program-reading-page')?.innerText.includes('Bản nháp đã lưu')")
    console.log('PASS program create, reload and publish')

    await navigate('/lesson-plans?referenceCategory=all')
    await wait("document.querySelector('.reference-directory')")
    await click('Thêm tài liệu')
    await wait("document.querySelector('input[aria-label=\"Tiêu đề tài liệu\"]')")
    await fill('input[aria-label="Tiêu đề tài liệu"]', 'Tài liệu kiểm tra lưu thật')
    await click('Lưu nháp', '.reference-reading-page button')
    await wait("!location.search.includes('new-reference-') && !!document.querySelector('.reference-reading-page')")
    await command('Page.reload'); await wait("document.querySelector('input[aria-label=\"Tiêu đề tài liệu\"]')?.value==='Tài liệu kiểm tra lưu thật'")
    await click('Xuất bản', '.reference-reading-page button')
    await wait("document.querySelector('.reference-reading-page h1')?.textContent==='Tài liệu kiểm tra lưu thật'")
    console.log('PASS reference create, reload and publish')
    assert.ok(apiCalls.some(([method, url]) => method === 'POST' && url === '/manage/lessons'))
    assert.ok(apiCalls.some(([method, url]) => method === 'POST' && url === '/manage/programs'))
    assert.ok(apiCalls.some(([method, url]) => method === 'POST' && url === '/manage/references'))

    await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: injection.identifier })
    await command('Page.addScriptToEvaluateOnNewDocument', { source: seed('reader') })
    await navigate(lessonUrl)
    await wait("document.querySelector('.lesson-reading-page h1')?.textContent==='Nội dung chưa lưu khi API lỗi'")
    assert.equal(await evaluate("[...document.querySelectorAll('.lesson-reading-page button')].some(e=>e.textContent.includes('Chỉnh sửa'))"), false)
    console.log('PASS reader reloads published lesson without management controls; no live AWS requests')
    await click('Đăng xuất')
    await wait("document.querySelector('input[type=email]') && !document.querySelector('.lesson-reading-page')")
    console.log('PASS logout works after pending uploads finish')
} finally {
    socket?.close(); chrome.kill(); python.kill(); server.closeAllConnections(); server.close()
}
