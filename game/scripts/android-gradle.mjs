// Runs the Android Gradle wrapper for the Capacitor project: node scripts/android-gradle.mjs assembleDebug
// Capacitor 8 / AGP 8.13 need JDK 21. If JAVA_HOME points at an older JDK, the
// JetBrains Runtime bundled with Android Studio is used when it can be found.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const androidDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'android')
const win = process.platform === 'win32'

function javaMajor(home) {
  const bin = home ? join(home, 'bin', win ? 'java.exe' : 'java') : 'java'
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' })
  const m = /version "(\d+)/.exec(`${r.stderr}${r.stdout}`)
  return m ? Number(m[1]) : 0
}

const env = { ...process.env }
if (javaMajor(env.JAVA_HOME) < 21) {
  const candidates = [
    'C:/Program Files/Android/Android Studio/jbr',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/android-studio/jbr',
    `${process.env.HOME ?? ''}/android-studio/jbr`,
  ]
  const jbr = candidates.find((c) => existsSync(c) && javaMajor(c) >= 21)
  if (jbr) {
    console.log(`[android] using JDK at ${jbr}`)
    env.JAVA_HOME = jbr
  } else {
    console.warn('[android] JDK 21+ not found (set JAVA_HOME); the build will probably fail')
  }
}

const tasks = process.argv.slice(2)
const cmd = win ? `"${join(androidDir, 'gradlew.bat')}"` : './gradlew'
const r = spawnSync(cmd, tasks.length ? tasks : ['assembleDebug'], { cwd: androidDir, env, stdio: 'inherit', shell: win })
process.exit(r.status ?? 1)
