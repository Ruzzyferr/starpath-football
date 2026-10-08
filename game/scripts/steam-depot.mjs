// Lays CI desktop artifacts out as Steam depots and renders the steamcmd build scripts (2.9#117/#118).
//   node scripts/steam-depot.mjs <artifactsDir> <outDir>
// Input:  <artifactsDir>/desktop-{windows,macos,ubuntu}-latest/<installers>
// Output: <outDir>/content/{windows,macos,linux}/..., <outDir>/app_build.vdf, <outDir>/depot_<id>.vdf
// Upload: `steamcmd +login <build account> +run_app_build <outDir>/app_build.vdf +quit` is
// BLOCKED-EXTERNAL (Steam partner account + real app/depot ids; set SP_STEAM_APP_ID).
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const OS_MAP = { 'desktop-windows-latest': 'windows', 'desktop-macos-latest': 'macos', 'desktop-ubuntu-latest': 'linux' }

export function appBuildVdf({ appId, branch, depots }) {
  const lines = depots.map((d) => `    "${d.id}" "depot_${d.id}.vdf"`).join('\n')
  return `"AppBuild"\n{\n  "AppID" "${appId}"\n  "Desc" "StarPath Football CI build"\n  "SetLive" "${branch}"\n  "ContentRoot" "./content/"\n  "BuildOutput" "./output/"\n  "Depots"\n  {\n${lines}\n  }\n}\n`
}

export function depotVdf({ id, os }) {
  return `"DepotBuild"
{
  "DepotID" "${id}"
  "FileMapping"
  {
    "LocalPath" "${os}/*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "*.pdb"
}
`
}

export function assemble(artifactsDir, outDir, env = process.env) {
  const appId = Number(env.SP_STEAM_APP_ID) || 480 // 480 = Valve's Spacewar test app, never a real id
  const branch = env.SP_STEAM_BRANCH ?? '' // empty = upload without setting any branch live
  const depots = []
  mkdirSync(join(outDir, 'content'), { recursive: true })
  for (const name of readdirSync(artifactsDir)) {
    const os = OS_MAP[name]
    if (!os) continue
    const dest = join(outDir, 'content', os)
    cpSync(join(artifactsDir, name), dest, { recursive: true })
    const id = appId + 1 + depots.length
    depots.push({ id, os })
    writeFileSync(join(outDir, `depot_${id}.vdf`), depotVdf({ id, os }))
  }
  if (!depots.length) throw new Error(`no desktop-* artifacts found in ${artifactsDir}`)
  writeFileSync(join(outDir, 'app_build.vdf'), appBuildVdf({ appId, branch, depots }))
  return { appId, depots }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [a, o] = process.argv.slice(2)
  if (!a || !o || !existsSync(a)) {
    console.error('usage: node scripts/steam-depot.mjs <artifactsDir> <outDir>')
    process.exit(2)
  }
  const r = assemble(resolve(a), resolve(o))
  console.log(`Steam depots ready for app ${r.appId}: ${r.depots.map((d) => `${d.os}=${d.id}`).join(', ')}`)
}
