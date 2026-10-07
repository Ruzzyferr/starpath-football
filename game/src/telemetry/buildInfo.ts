/** Build-time constants injected by vite.config.ts (`define`). Fallbacks keep tests / tooling working. */
declare const __APP_VERSION__: string
declare const __BUILD_COMMIT__: string
declare const __BUILD_TIME__: string

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
export const BUILD_COMMIT: string = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev'
export const BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''

/** e.g. "0.1.0 (a1b2c3d)" */
export const buildLabel = (): string => `${APP_VERSION} (${BUILD_COMMIT})`
