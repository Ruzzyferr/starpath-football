# Architecture Decision Records

Short, dated, append-only. New decisions get the next number; a reversed decision is superseded, never edited (GAP-AUDIT 2.9#128).
Format: Context, Decision, Consequences.

## ADR-001 Local-first, no backend in v1 (2026-10)
Context: no server budget; the genre does not need one. Decision: every feature works offline; saves, settings, records live on the device; no analytics. Consequences: leaderboards, cloud saves and receipt validation are BLOCKED-EXTERNAL (backend); privacy is trivially good ("delete all my data" is local, `src/state/privacy.ts`).

## ADR-002 Procedural audio (WebAudio synthesis) instead of recorded files (2026-10)
Context: no licensed recordings. Decision: all sounds are synthesised (`src/audio`, `src/game/audio.ts`); `assets/LICENSES.csv` + `licenses.node.test.ts` gate any future file. Consequences: tiny bundle (`audioFileBytes` budget); real crowd/commentary recordings are deferred until recorded audio exists.

## ADR-003 Phaser only inside the match (2026-10)
Context: Phaser is 520 KB gzipped. Decision: lazy chunk loaded at the first playable moment; everything else is DOM/Preact. Consequences: cold start budget (`jsInitialGzKB`) excludes it; WebGL context loss is handled globally (`platform/glRecovery.ts`).

## ADR-004 Save integrity is FNV-1a, not SHA-256 (2026-10)
Context: saves are 1-3 MB and verified several times per write. Decision: FNV-1a 32-bit + length detects truncation and bit rot; it is not a security boundary. Consequences: tamper resistance for local records is a deterrent only (`metaStore` seal); a hash upgrade needs an async API and a `checksum` version prefix.

## ADR-005 ES2022 build target (2026-10)
Context: Electron 44, current WebViews (Android 7+ via Chromium updates, iOS 16+). Decision: `build.target = es2022`, TypeScript target es2023 for type-level APIs only. Consequences: no transpilation overhead; older WebViews are unsupported.

## ADR-006 Electron renderer is locked down by default (2026-10)
Context: the shell loads only local files. Decision: contextIsolation + sandbox, no Node in the renderer, strict CSP (`electron/csp.cjs`), all permission requests denied, security fuses flipped at package time (`electron-builder.yml`), crashed renderer reloads at most 3 times per minute. Consequences: any feature needing a remote origin must amend the CSP and this record.

## ADR-007 `noUncheckedIndexedAccess` is deferred (2026-10)
Context: enabling it today yields ~1,700 type errors concentrated in `src/sim` and `src/ui`. Decision: not enabled; new code is written index-safe, the flag is turned on per directory when a sweep touches it. Consequences: tracked as ERTELENDİ in GAP-AUDIT 2.9#2.
