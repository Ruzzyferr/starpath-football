/** "StarPath Football" wordmark: condensed italic type riding a pitch-line arc with a star. */
export function Logo({ size = 'md', sub = true }: { size?: 'sm' | 'md' | 'xl'; sub?: boolean }) {
  return (
    <div class={`logo logo-${size}`} role="img" aria-label="StarPath Football"> {/* i18n-ok brand */}
      <svg class="logo-mark" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#2be88a" />
            <stop offset="1" stop-color="#0e9f57" />
          </linearGradient>
        </defs>
        <path d="M6 40C14 22 28 12 44 8" fill="none" stroke="url(#logo-g)" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 7" />
        <path d="M30 4l3.1 6.4 7 1-5.1 4.9 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-4.9 7-1z" fill="#ffc83d" />
        <circle cx="8" cy="39" r="5.5" fill="#f2f5fa" />
        <path d="M8 35.5l2.6 1.9-1 3h-3.2l-1-3z" fill="#0b1220" />
      </svg>
      <div class="logo-type">
        <span class="logo-word">
          <span class="logo-star">STAR</span> {/* i18n-ok brand */}
          <span class="logo-path">PATH</span> {/* i18n-ok brand */}
        </span>
        {sub && <span class="logo-sub">FOOTBALL</span>} {/* i18n-ok brand */}
      </div>
    </div>
  )
}
