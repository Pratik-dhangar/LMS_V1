const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const OUT = path.join(__dirname, '..', 'public', 'speedtest.bin')
const SIZE = 200 * 1024 // 200 KB

const buf = crypto.randomBytes(SIZE)
fs.writeFileSync(OUT, buf)
console.log('Wrote', OUT, 'size', buf.length)
