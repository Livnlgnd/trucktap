import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const out = path.join(root, 'dist-mobile')
const appEntry = path.join(dist, 'app', 'index.html')

if (!existsSync(appEntry)) {
  console.error('Build the web app before preparing the mobile bundle.')
  process.exit(1)
}

rmSync(out, { recursive: true, force: true })
cpSync(dist, out, { recursive: true })

// Capacitor loads webDir/index.html. The desktop build puts the field app at
// app/index.html, so promote that entry to the bundle root.
const html = readFileSync(appEntry, 'utf8')
  .replace(
    '<title>TruckTap App - Tech Clicker &amp; Shop Pick-List</title>',
    '<title>TruckTap</title>',
  )
  .replace(
    '<meta name="robots" content="noindex,follow" />',
    '<meta name="robots" content="noindex,nofollow" />',
  )
writeFileSync(path.join(out, 'index.html'), html)

// The marketing site and demo media are not needed inside the native shell.
for (const name of ['demo', 'screenshots']) {
  rmSync(path.join(out, name), { recursive: true, force: true })
}

console.log('Prepared dist-mobile from the TruckTap field app bundle.')
