// The Title backdrop: the Silverwood Ruins at night in DESIGN §17.1's Ruins palette (sky #1B1F3B → #4A3F6B, far
// #2E2A4D, mid #5B5380, near #1A1826, crystal glow #9FD8FF): far spires, the broken Archway, rubble and the crystals
// that grow where the lanterns hung. Static and decorative; the parametric Scene system (U71) replaces it.
import type { ReactNode } from 'react';

export function TitleArt(): ReactNode {
  return (
    <svg className="title-art" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="title-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B1F3B" />
          <stop offset="1" stopColor="#4A3F6B" />
        </linearGradient>
        <radialGradient id="title-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#9FD8FF" stopOpacity={0.55} />
          <stop offset="1" stopColor="#9FD8FF" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width="1200" height="500" fill="url(#title-sky)" />
      {/* far spires of the capital */}
      <path
        fill="#2E2A4D"
        opacity={0.85}
        d="M0 330 L60 330 L72 250 L84 330 L150 330 L160 290 L176 210 L192 290 L200 330 L300 330 L318 270 L336 330 L420 330 L436 230 L452 160 L468 230 L484 330 L560 330 L700 330 L716 280 L732 330 L820 330 L838 200 L856 120 L874 200 L892 330 L980 330 L996 260 L1012 330 L1090 330 L1104 240 L1118 330 L1200 330 L1200 500 L0 500 Z"
      />
      {/* the broken Archway */}
      <path
        fill="#5B5380"
        d="M470 500 L470 300 C 470 230, 520 190, 580 184 L586 198 C 534 206, 506 244, 506 300 L506 500 Z M694 500 L694 330 C 694 300, 686 276, 672 258 L690 246 C 714 270, 730 300, 730 340 L730 500 Z"
      />
      {/* crystal glow where the lanterns hung */}
      <circle cx="600" cy="300" r="120" fill="url(#title-glow)" className="title-art__glow" />
      <path fill="#9FD8FF" opacity={0.9} d="M592 360 L600 296 L610 360 Z M616 372 L626 330 L634 372 Z M572 376 L580 342 L586 376 Z" />
      {/* near rubble */}
      <path
        fill="#1A1826"
        d="M0 420 C 120 400, 220 430, 330 412 C 420 398, 520 430, 600 420 C 700 408, 790 436, 900 416 C 1000 400, 1100 428, 1200 410 L1200 500 L0 500 Z"
      />
    </svg>
  );
}
