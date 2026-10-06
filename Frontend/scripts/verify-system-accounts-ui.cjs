const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const read = (file) => {
  const target = path.join(root, file)
  assert.ok(fs.existsSync(target), `Thiếu tệp bắt buộc: ${file}`)
  return fs.readFileSync(target, 'utf8')
}

const accountsPage = read('app/accounts/page.tsx')
const accountsDirectory = read('components/system-account-directory.tsx')
const header = read('components/site-header.tsx')
const homePage = read('app/page.tsx')

assert.match(accountsPage, /initialView="accounts"/, 'Trang /accounts phải mở chế độ tài khoản.')
assert.match(accountsDirectory, /Tài khoản hệ thống/, 'Trang phải có tiêu đề quản lý tài khoản.')
assert.match(accountsDirectory, /Cấp tài khoản/, 'Admin phải có hành động cấp tài khoản.')
assert.match(accountsDirectory, /Editor/, 'Biểu mẫu phải cho phép cấp quyền Editor.')
assert.match(accountsDirectory, /Tài khoản dùng chung/, 'Biểu mẫu phải cho phép cấp tài khoản Reader dùng chung.')
assert.match(header, /currentUser/, 'Menu phải nhận vai trò người dùng hiện tại.')
assert.match(header, /Tài khoản hệ thống/, 'Menu phải có mục quản lý tài khoản.')
assert.match(homePage, /initialView.*accounts/, 'Trang gốc phải hỗ trợ chế độ accounts.')
assert.match(homePage, /Bạn không có quyền truy cập khu vực này/, 'Người không phải admin phải thấy thông báo khi mở trực tiếp trang tài khoản.')

console.log('System accounts UI checks passed.')
