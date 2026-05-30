const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = path.join(root, 'src/assets/favicon.png')
const buildDir = path.join(root, 'build')
const icoOut = path.join(buildDir, 'icon.ico')
const pngOut = path.join(buildDir, 'icon.png')

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })

const pngData = fs.readFileSync(src)

// ICO with one PNG-compressed entry (Windows Vista+ supports PNG-in-ICO)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)

const dir = Buffer.alloc(16)
dir.writeUInt8(0, 0)
dir.writeUInt8(0, 1)
dir.writeUInt8(0, 2)
dir.writeUInt8(0, 3)
dir.writeUInt16LE(1, 4)
dir.writeUInt16LE(32, 6)
dir.writeUInt32LE(pngData.length, 8)
dir.writeUInt32LE(22, 12)

fs.writeFileSync(icoOut, Buffer.concat([header, dir, pngData]))
fs.copyFileSync(src, pngOut)
console.log('icon.ico and icon.png generated in build/')
