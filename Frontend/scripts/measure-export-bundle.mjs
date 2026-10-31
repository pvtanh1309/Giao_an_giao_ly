import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { gzipSync, brotliCompressSync, constants } from 'node:zlib'

// Run after a production static export. These are compressed artifact estimates,
// not browser transfer sizes or timings; async chunks loaded later are separate.
const output = fileURLToPath(new URL('../out/', import.meta.url))
const measured = new Map()
function measure(file) {
    if (!measured.has(file)) {
        const data = readFileSync(join(output, file))
        measured.set(file, {
            file,
            raw: data.length,
            gzip: gzipSync(data, { level: 9 }).length,
            brotli: brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
        })
    }
    return measured.get(file)
}

const routes = readdirSync(output).filter(file => file.endsWith('.html') && !['404.html', '_not-found.html'].includes(file)).sort().map(file => {
    const html = readFileSync(join(output, file), 'utf8')
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)]
    const scripts = [...new Set(tags.filter(match => !/nomodule/i.test(match[0]) && match[1].startsWith('/_next/')).map(match => match[1].slice(1)))]
    if (!scripts.length) throw new Error(`No exported Next.js scripts found for ${file}`)
    const files = scripts.map(measure)
    return {
        route: file === 'index.html' ? '/' : `/${file.slice(0, -5)}`,
        files,
        total: Object.fromEntries(['raw', 'gzip', 'brotli'].map(key => [key, files.reduce((sum, entry) => sum + entry[key], 0)])),
    }
})
console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    method: 'Modern script tags in exported HTML; raw bytes, per-file gzip level 9 and Brotli quality 11; excludes async chunks, legacy polyfills, HTTP headers and non-JS assets',
    routes,
}, null, 2))
