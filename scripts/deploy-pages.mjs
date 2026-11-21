import { execSync } from 'node:child_process'
import {
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const outputDir = mkdtempSync(path.join(os.tmpdir(), 'trucktap-pages-'))

try {
  const buildEnv = {
    ...process.env,
    VITE_BASE_PATH: '/trucktap/',
    VITE_API_URL: 'https://trucktap-blush.vercel.app',
    ELECTRON_SKIP_BINARY_DOWNLOAD: '1',
  }

  console.log('Building GitHub Pages bundle…')
  execSync('npm run build', {
    cwd: root,
    stdio: 'inherit',
    env: buildEnv,
    shell: true,
  })

  cpSync(path.join(root, 'dist'), outputDir, { recursive: true })
  writeFileSync(path.join(outputDir, '.nojekyll'), '')

  const remote = execSync('git remote get-url origin', {
    cwd: root,
    encoding: 'utf8',
  }).trim()

  execSync('git init -b gh-pages', { cwd: outputDir, stdio: 'inherit' })
  execSync('git add -A', { cwd: outputDir, stdio: 'inherit' })
  execSync(
    `git -c user.name="TruckTap Deploy" -c user.email="deploy@trucktap.local" commit -m "Deploy ${new Date().toISOString()}"`,
    { cwd: outputDir, stdio: 'inherit' },
  )
  execSync(`git remote add origin "${remote}"`, {
    cwd: outputDir,
    stdio: 'inherit',
  })
  execSync(
    'git -c credential.helper= -c "credential.https://github.com.helper=!gh auth git-credential" push --force origin gh-pages',
    {
      cwd: outputDir,
      stdio: 'inherit',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      shell: true,
    },
  )

  console.log('GitHub Pages branch updated: gh-pages')
} finally {
  rmSync(outputDir, { recursive: true, force: true })
}
