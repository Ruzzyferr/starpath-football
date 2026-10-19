/** "Kickborn" wordmark: condensed italic two-tone type (KICK white, BORN pitch green) beside the app icon. */
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'xl' }) {
  return (
    <div class={`logo logo-${size}`} role="img" aria-label="Kickborn"> {/* i18n-ok brand */}
      {/* The app icon (key art: the player running at the ball) is the mark; same file as the PWA icon. */}
      <img class="logo-mark" src="./icons/icon-192.png" alt="" aria-hidden="true" width={48} height={48} decoding="async" />
      <div class="logo-type">
        <span class="logo-word">
          {/* i18n-ok brand: one word, two tones, no space */}
          <span class="logo-star">KICK</span>{/* i18n-ok brand */}<span class="logo-path">BORN</span>{/* i18n-ok brand */}
        </span>
      </div>
    </div>
  )
}
