/**
 * Original Eureka Games cover art.
 * Run: node assets/covers/build-covers.mjs
 * Each file is a self-contained SVG (no external images, fonts, or marks).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = dirname(fileURLToPath(import.meta.url));

const covers = [
  {
    file: 'ageofwar.svg',
    title: 'Age of War cover',
    sky: ['#3a2012', '#120c08'],
    glow: '#e2b15a',
    body: `
      <ellipse cx="320" cy="430" rx="420" ry="150" fill="#1c140c"/>
      <path d="M0 300 Q160 250 320 292 T640 268 V400 H0 Z" fill="#24180e"/>
      <g fill="#6a5034">
        <rect x="78" y="168" width="92" height="132"/>
        <rect x="70" y="156" width="22" height="22"/><rect x="100" y="148" width="22" height="30"/><rect x="130" y="156" width="22" height="22"/>
        <rect x="92" y="196" width="18" height="28" fill="#1a1008"/>
        <rect x="122" y="206" width="28" height="18" fill="#1a1008"/>
      </g>
      <path d="M108 148 L118 118 L128 148 Z" fill="#e2b15a"/>
      <rect x="114" y="128" width="8" height="22" fill="#e2b15a"/>
      <g fill="#8a5a32">
        <rect x="470" y="188" width="110" height="108"/>
        <polygon points="458,188 580,188 568,156 470,156"/>
        <rect x="498" y="214" width="22" height="30" fill="#1a1008"/>
        <rect x="538" y="214" width="22" height="30" fill="#1a1008"/>
      </g>
      <circle cx="548" cy="176" r="10" fill="#ff7a3c"/>
      <circle cx="548" cy="168" r="6" fill="#ffd7a1"/>
      <path d="M210 250 Q320 120 470 210" fill="none" stroke="#e2b15a" stroke-width="3" stroke-dasharray="2 8" opacity="0.8"/>
      <circle cx="330" cy="148" r="6" fill="#f3d48a"/>
      <g fill="#d7c3a2">
        <polygon points="230,286 238,262 246,286"/>
        <polygon points="258,292 266,266 274,292"/>
        <polygon points="286,288 294,270 302,288"/>
      </g>
      <circle cx="96" cy="72" r="18" fill="#f0c98a" opacity="0.9"/>
    `,
  },
  {
    file: 'tycoon.svg',
    title: 'Startup Tycoon cover',
    sky: ['#123056', '#070d16'],
    glow: '#58a6ff',
    body: `
      <g fill="#0e1c30">
        <rect x="70" y="210" width="70" height="150"/>
        <rect x="160" y="160" width="78" height="200"/>
        <rect x="258" y="120" width="86" height="240"/>
        <rect x="364" y="78" width="92" height="282"/>
        <rect x="476" y="46" width="100" height="314"/>
      </g>
      <g fill="#58a6ff" opacity="0.85">
        <rect x="84" y="228" width="10" height="14"/><rect x="102" y="228" width="10" height="14"/><rect x="120" y="228" width="10" height="14"/>
        <rect x="84" y="252" width="10" height="14"/><rect x="102" y="252" width="10" height="14"/>
        <rect x="176" y="180" width="12" height="16"/><rect x="198" y="180" width="12" height="16"/><rect x="220" y="180" width="12" height="16"/>
        <rect x="176" y="208" width="12" height="16"/><rect x="198" y="208" width="12" height="16"/><rect x="220" y="208" width="12" height="16"/>
        <rect x="276" y="142" width="14" height="18"/><rect x="300" y="142" width="14" height="18"/><rect x="324" y="142" width="14" height="18"/>
        <rect x="276" y="172" width="14" height="18"/><rect x="300" y="172" width="14" height="18"/>
        <rect x="382" y="100" width="16" height="20"/><rect x="408" y="100" width="16" height="20"/><rect x="434" y="100" width="16" height="20"/>
        <rect x="382" y="132" width="16" height="20"/><rect x="408" y="132" width="16" height="20"/><rect x="434" y="132" width="16" height="20"/>
        <rect x="494" y="70" width="16" height="20"/><rect x="522" y="70" width="16" height="20"/><rect x="550" y="70" width="16" height="20"/>
        <rect x="494" y="102" width="16" height="20"/><rect x="522" y="102" width="16" height="20"/><rect x="550" y="102" width="16" height="20"/>
      </g>
      <path d="M80 300 C180 280 220 220 300 190 S460 90 560 70" fill="none" stroke="#9ad0ff" stroke-width="4"/>
      <circle cx="560" cy="70" r="7" fill="#e7f3ff"/>
      <polygon points="500,40 520,18 508,40" fill="#f0c552"/>
    `,
  },
  {
    file: 'growop.svg',
    title: 'Grow Op cover',
    sky: ['#102418', '#070d09'],
    glow: '#3fb950',
    body: `
      <rect x="40" y="40" width="560" height="320" rx="8" fill="none" stroke="#245c34" stroke-width="6"/>
      <g stroke="#1d4a2c" stroke-width="3">
        <path d="M40 120 H600"/><path d="M40 200 H600"/><path d="M40 280 H600"/>
      </g>
      <g>
        ${[80, 180, 280, 380, 480].map((x) => `
          <path d="M${x + 30} 118 C${x + 10} 90 ${x + 8} 70 ${x + 30} 48 C${x + 52} 70 ${x + 50} 90 ${x + 30} 118 Z" fill="#3fb950"/>
          <path d="M${x + 30} 118 C${x} 100 ${x - 8} 78 ${x + 18} 58" fill="none" stroke="#7dff9a" stroke-width="3"/>
          <rect x="${x + 22}" y="112" width="16" height="10" rx="2" fill="#6b4a2a"/>
        `).join('')}
        ${[110, 230, 350, 470].map((x) => `
          <ellipse cx="${x}" cy="188" rx="22" ry="16" fill="#2f9e44"/>
          <ellipse cx="${x + 16}" cy="180" rx="16" ry="12" fill="#57d06a"/>
          <rect x="${x - 6}" y="198" width="18" height="8" fill="#6b4a2a"/>
        `).join('')}
      </g>
      <g>
        <rect x="70" y="36" width="70" height="12" rx="3" fill="#7c5cff"/>
        <rect x="250" y="36" width="70" height="12" rx="3" fill="#c084fc"/>
        <rect x="450" y="36" width="70" height="12" rx="3" fill="#7c5cff"/>
        <path d="M105 48 V90 M285 48 V90 M485 48 V90" stroke="#c4b5fd" stroke-width="2" opacity="0.7"/>
      </g>
      <rect x="548" y="150" width="14" height="90" rx="7" fill="#102018" stroke="#f0883e"/>
      <rect x="550" y="190" width="10" height="48" rx="5" fill="#f0883e"/>
    `,
  },
  {
    file: 'homeless.svg',
    title: 'Homeless Village cover',
    sky: ['#243044', '#14110e'],
    glow: '#f0883e',
    body: `
      <path d="M0 70 H640 V230 Q480 120 320 150 Q160 180 0 110 Z" fill="#1a1814"/>
      <path d="M0 86 H640" stroke="#3a342c" stroke-width="8"/>
      <rect x="0" y="250" width="640" height="150" fill="#1c1814"/>
      <g>
        <polygon points="90,300 150,230 210,300" fill="#c4a574"/>
        <rect x="108" y="300" width="84" height="40" fill="#8a6a42"/>
        <polygon points="250,310 320,236 390,310" fill="#d7c3a2"/>
        <rect x="276" y="310" width="88" height="36" fill="#6e5434"/>
        <polygon points="430,292 500,228 570,292" fill="#b08968"/>
        <rect x="452" y="292" width="96" height="48" fill="#7a5a38"/>
      </g>
      <rect x="300" y="250" width="36" height="28" rx="4" fill="#3a2a22"/>
      <ellipse cx="318" cy="246" rx="16" ry="8" fill="#f0883e"/>
      <ellipse cx="318" cy="238" rx="8" ry="8" fill="#ffd7a1"/>
      <g fill="#f0c98a" opacity="0.85">
        <circle cx="40" cy="40" r="1.5"/><circle cx="120" cy="28" r="1.5"/><circle cx="200" cy="48" r="1.2"/>
        <circle cx="520" cy="36" r="1.5"/><circle cx="590" cy="24" r="1.2"/>
      </g>
      <path d="M80 168 Q200 150 320 168 Q440 186 560 160" fill="none" stroke="#f0c552" stroke-width="2" opacity="0.7"/>
      <g fill="#f0c552">
        <circle cx="120" cy="160" r="3"/><circle cx="220" cy="156" r="3"/><circle cx="320" cy="168" r="3"/>
        <circle cx="420" cy="176" r="3"/><circle cx="520" cy="162" r="3"/>
      </g>
    `,
  },
  {
    file: 'hearthvale.svg',
    title: 'Hearthvale cover',
    sky: ['#8ec6e8', '#d7efc8'],
    glow: '#ffffff',
    body: `
      <path d="M0 250 Q160 210 320 240 T640 220 V400 H0 Z" fill="#6aaa58"/>
      <path d="M0 300 Q180 270 340 310 T640 280 V400 H0 Z" fill="#3d7ea6"/>
      <path d="M0 318 Q200 300 360 330 T640 300" fill="none" stroke="#d5f0ff" stroke-width="3" opacity="0.7"/>
      <g>
        <rect x="78" y="168" width="86" height="70" fill="#f4e2c4"/>
        <polygon points="66,168 121,112 176,168" fill="#c45c3e"/>
        <rect x="108" y="198" width="22" height="40" fill="#6b4630"/>
        <rect x="150" y="128" width="10" height="28" fill="#8a5a44"/>
        <path d="M155 112 q8 -18 4 -28" fill="none" stroke="#f7f7f7" stroke-width="3"/>
      </g>
      <g>
        <rect x="250" y="150" width="110" height="86" fill="#f7ead2"/>
        <polygon points="236,150 305,86 374,150" fill="#a34432"/>
        <rect x="292" y="186" width="26" height="50" fill="#5c3b28"/>
        <rect x="262" y="168" width="22" height="18" fill="#9fd0e6"/>
        <rect x="328" y="168" width="22" height="18" fill="#9fd0e6"/>
        <rect x="340" y="104" width="12" height="36" fill="#8a5a44"/>
      </g>
      <g>
        <rect x="450" y="176" width="92" height="64" fill="#efe0c4"/>
        <polygon points="438,176 496,124 554,176" fill="#b85a3c"/>
        <rect x="484" y="204" width="20" height="36" fill="#6b4630"/>
      </g>
      <circle cx="560" cy="70" r="22" fill="#fff4c8"/>
      <ellipse cx="210" cy="250" rx="26" ry="10" fill="#3e8f45"/>
      <ellipse cx="430" cy="246" rx="20" ry="8" fill="#3e8f45"/>
    `,
  },
  {
    file: 'voxelisle.svg',
    title: 'Voxel Isle cover',
    sky: ['#7ec8ff', '#16324a'],
    glow: '#ffffff',
    body: `
      <ellipse cx="320" cy="340" rx="180" ry="28" fill="#0e4a6e" opacity="0.45"/>
      <g>
        <polygon points="250,250 320,210 390,250 320,290" fill="#6b8f4a"/>
        <polygon points="250,250 320,290 320,330 250,290" fill="#4e7334"/>
        <polygon points="390,250 320,290 320,330 390,290" fill="#3e5c28"/>
        <polygon points="300,210 360,176 420,214 360,248" fill="#7ea85a"/>
        <polygon points="300,210 360,248 360,280 300,242" fill="#5e8640"/>
        <polygon points="420,214 360,248 360,280 420,246" fill="#4c7034"/>
      </g>
      <g>
        <polygon points="300,176 328,160 356,176 328,192" fill="#8fd06a"/>
        <polygon points="300,176 328,192 328,210 300,194" fill="#5ea84a"/>
        <polygon points="356,176 328,192 328,210 356,194" fill="#4e903c"/>
        <polygon points="360,168 388,152 416,168 388,184" fill="#d2b48a"/>
        <polygon points="360,168 388,184 388,202 360,186" fill="#b8926a"/>
        <polygon points="416,168 388,184 388,202 416,186" fill="#9a7450"/>
      </g>
      <g>
        <polygon points="250,150 270,138 290,150 270,162" fill="#2f6b34"/>
        <polygon points="270,110 286,138 254,138" fill="#3fb950"/>
      </g>
      <polygon points="470,250 500,232 530,250 500,268" fill="#c4a574"/>
      <polygon points="470,250 500,268 500,290 470,272" fill="#a68458"/>
      <polygon points="530,250 500,268 500,290 530,272" fill="#8a6c44"/>
    `,
  },
  {
    file: 'studio.svg',
    title: 'Eureka Studio cover',
    sky: ['#2a1848', '#100818'],
    glow: '#bc8cff',
    body: `
      <rect x="40" y="250" width="560" height="18" rx="4" fill="#2a2040"/>
      <rect x="70" y="268" width="16" height="70" fill="#241838"/>
      <rect x="554" y="268" width="16" height="70" fill="#241838"/>
      <g>
        <rect x="86" y="78" width="150" height="100" rx="6" fill="#0c1018" stroke="#58a6ff" stroke-width="3"/>
        <path d="M100 150 L118 118 L136 140 L160 100 L210 150" fill="none" stroke="#3fb950" stroke-width="3"/>
        <rect x="250" y="96" width="150" height="100" rx="6" fill="#0c1018" stroke="#bc8cff" stroke-width="3"/>
        <rect x="266" y="114" width="70" height="8" rx="2" fill="#8b83ff"/>
        <rect x="266" y="130" width="110" height="6" rx="2" fill="#3a3358"/>
        <rect x="266" y="144" width="90" height="6" rx="2" fill="#3a3358"/>
        <rect x="266" y="158" width="50" height="6" rx="2" fill="#58a6ff"/>
        <rect x="420" y="70" width="150" height="110" rx="6" fill="#0c1018" stroke="#f0c552" stroke-width="3"/>
        <circle cx="495" cy="124" r="22" fill="none" stroke="#f0c552" stroke-width="4"/>
        <path d="M495 102 V124 L510 132" fill="none" stroke="#f0c552" stroke-width="3"/>
      </g>
      <rect x="120" y="210" width="400" height="14" rx="3" fill="#3a3058"/>
      <rect x="160" y="230" width="320" height="22" rx="4" fill="#241838"/>
      <circle cx="80" cy="50" r="3" fill="#fff" opacity="0.5"/>
      <circle cx="560" cy="40" r="2" fill="#fff" opacity="0.4"/>
    `,
  },
  {
    file: 'snake.svg',
    title: 'Snake cover',
    sky: ['#0c2414', '#061208'],
    glow: '#39ff14',
    body: `
      <g fill="#12301c">
        ${Array.from({ length: 8 }, (_, y) => Array.from({ length: 12 }, (_, x) =>
          `<rect x="${48 + x * 46}" y="${36 + y * 42}" width="36" height="32" rx="4"/>`).join('')).join('')}
      </g>
      <g fill="#39ff14">
        <rect x="140" y="162" width="36" height="32" rx="6"/>
        <rect x="186" y="162" width="36" height="32" rx="6"/>
        <rect x="232" y="162" width="36" height="32" rx="6"/>
        <rect x="278" y="162" width="36" height="32" rx="6"/>
        <rect x="278" y="120" width="36" height="32" rx="6"/>
        <rect x="278" y="78" width="36" height="32" rx="6"/>
        <rect x="324" y="78" width="36" height="32" rx="6"/>
        <rect x="370" y="78" width="36" height="32" rx="8"/>
      </g>
      <circle cx="384" cy="90" r="3" fill="#061208"/>
      <circle cx="396" cy="90" r="3" fill="#061208"/>
      <circle cx="470" cy="214" r="14" fill="#ff3355"/>
      <ellipse cx="466" cy="208" rx="4" ry="3" fill="#ffd0d6"/>
      <path d="M470 200 Q478 186 490 192" fill="none" stroke="#3fb950" stroke-width="2"/>
    `,
  },
  {
    file: 'tetris.svg',
    title: 'Stack cover',
    sky: ['#241028', '#100814'],
    glow: '#f778ba',
    body: `
      <rect x="168" y="28" width="304" height="344" rx="6" fill="#140a16" stroke="#3a2444" stroke-width="6"/>
      <g>
        <rect x="184" y="292" width="64" height="32" fill="#22d3ee"/>
        <rect x="184" y="324" width="256" height="32" fill="#22d3ee"/>
        <rect x="248" y="260" width="64" height="32" fill="#facc15"/>
        <rect x="248" y="292" width="64" height="32" fill="#facc15"/>
        <rect x="312" y="228" width="96" height="32" fill="#a78bfa"/>
        <rect x="344" y="260" width="32" height="64" fill="#a78bfa"/>
        <rect x="184" y="228" width="64" height="32" fill="#3fb950"/>
        <rect x="216" y="196" width="32" height="32" fill="#3fb950"/>
        <rect x="376" y="292" width="64" height="32" fill="#f85149"/>
        <rect x="344" y="324" width="32" height="0"/>
        <rect x="408" y="260" width="32" height="64" fill="#58a6ff"/>
        <rect x="376" y="292" width="32" height="32" fill="#58a6ff"/>
      </g>
      <g>
        <rect x="280" y="56" width="32" height="96" fill="#f778ba"/>
        <rect x="248" y="88" width="32" height="32" fill="#f778ba"/>
      </g>
    `,
  },
  {
    file: 'breakout.svg',
    title: 'Neon Breaker cover',
    sky: ['#0c2430', '#061018'],
    glow: '#22d3ee',
    body: `
      ${['#f778ba', '#facc15', '#3fb950', '#58a6ff', '#a78bfa'].map((c, row) =>
        Array.from({ length: 8 }, (_, i) => {
          if (row === 2 && i === 4) return '';
          if (row === 1 && i === 2) return '';
          return `<rect x="${48 + i * 70}" y="${48 + row * 36}" width="60" height="26" rx="4" fill="${c}"/>`;
        }).join('')).join('')}
      <circle cx="360" cy="250" r="12" fill="#e8fbff"/>
      <circle cx="360" cy="250" r="22" fill="#22d3ee" opacity="0.25"/>
      <path d="M360 250 Q330 290 300 320" fill="none" stroke="#22d3ee" stroke-width="2" opacity="0.5"/>
      <rect x="250" y="332" width="120" height="16" rx="8" fill="#22d3ee"/>
      <rect x="286" y="332" width="28" height="16" rx="4" fill="#e8fbff"/>
    `,
  },
  {
    file: 'asteroids.svg',
    title: 'Vector Storm cover',
    sky: ['#16122a', '#07060f'],
    glow: '#a78bfa',
    body: `
      <g fill="#efeaff">
        <circle cx="80" cy="60" r="1.5"/><circle cx="160" cy="100" r="1.2"/><circle cx="540" cy="70" r="1.5"/>
        <circle cx="480" cy="200" r="1.2"/><circle cx="120" cy="300" r="1.4"/><circle cx="400" cy="40" r="1"/>
      </g>
      <g fill="none" stroke="#c4b5fd" stroke-width="3">
        <polygon points="120,180 180,150 210,200 170,250 110,230"/>
        <polygon points="430,90 500,70 540,120 500,170 440,150 420,110"/>
        <polygon points="460,240 530,220 560,280 510,320 450,290"/>
        <polygon points="200,300 250,280 270,320 220,340"/>
      </g>
      <polygon points="320,150 360,230 320,214 280,230" fill="none" stroke="#f5f3ff" stroke-width="3"/>
      <path d="M308 228 L320 258 L332 228" fill="none" stroke="#f0c552" stroke-width="3"/>
      <path d="M300 200 L250 190" stroke="#f5f3ff" stroke-width="2"/>
    `,
  },
  {
    file: '2048.svg',
    title: '2048 cover',
    sky: ['#3a3018', '#1a1408'],
    glow: '#facc15',
    body: `
      <rect x="150" y="36" width="340" height="328" rx="16" fill="#2a2416"/>
      ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) =>
        `<rect x="${170 + c * 80}" y="${56 + r * 76}" width="68" height="64" rx="8" fill="#3a3424"/>`).join('')).join('')}
      <g font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" text-anchor="middle">
        <rect x="170" y="56" width="68" height="64" rx="8" fill="#4a4030"/>
        <text x="204" y="96" fill="#efe6d2" font-size="28">2</text>
        <rect x="250" y="132" width="68" height="64" rx="8" fill="#6b5830"/>
        <text x="284" y="172" fill="#fff6d8" font-size="28">8</text>
        <rect x="330" y="208" width="68" height="64" rx="8" fill="#c48a22"/>
        <text x="364" y="248" fill="#1a1408" font-size="22">64</text>
        <rect x="410" y="56" width="68" height="64" rx="8" fill="#facc15"/>
        <text x="444" y="88" fill="#1a1408" font-size="16">2048</text>
        <rect x="170" y="284" width="68" height="64" rx="8" fill="#5a4a2c"/>
        <text x="204" y="324" fill="#fff6d8" font-size="28">4</text>
      </g>
    `,
  },
  {
    file: 'minefield.svg',
    title: 'Minefield cover',
    sky: ['#2a1c12', '#120c08'],
    glow: '#f0883e',
    body: `
      <rect x="120" y="40" width="400" height="320" rx="8" fill="#1a120c"/>
      ${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) =>
        `<rect x="${140 + c * 74}" y="${58 + r * 60}" width="64" height="50" rx="4" fill="#3a2a1c" stroke="#5a4030"/>`).join('')).join('')}
      <g font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" font-size="26" text-anchor="middle">
        <rect x="140" y="58" width="64" height="50" rx="4" fill="#efe6d6"/>
        <text x="172" y="92" fill="#58a6ff">1</text>
        <rect x="214" y="58" width="64" height="50" rx="4" fill="#efe6d6"/>
        <text x="246" y="92" fill="#3fb950">2</text>
        <rect x="288" y="118" width="64" height="50" rx="4" fill="#efe6d6"/>
        <text x="320" y="152" fill="#f85149">3</text>
        <rect x="362" y="178" width="64" height="50" rx="4" fill="#efe6d6"/>
        <text x="394" y="212" fill="#1a1408">1</text>
      </g>
      <g>
        <rect x="436" y="242" width="64" height="50" rx="4" fill="#f0883e"/>
        <polygon points="456,258 480,270 456,282" fill="#f2f2f2"/>
        <rect x="454" y="258" width="3" height="26" fill="#1a1408"/>
      </g>
    `,
  },
  {
    file: 'lightcycles.svg',
    title: 'Light Cycles cover',
    sky: ['#101820', '#060810'],
    glow: '#22d3ee',
    body: `
      <g stroke="#163040" stroke-width="1">
        ${Array.from({ length: 12 }, (_, i) => `<path d="M${40 + i * 50} 20 V380"/>`).join('')}
        ${Array.from({ length: 8 }, (_, i) => `<path d="M20 ${40 + i * 46} H620"/>`).join('')}
      </g>
      <path d="M80 300 H260 V140 H420" fill="none" stroke="#22d3ee" stroke-width="8" stroke-linejoin="round"/>
      <polygon points="420,140 450,128 450,152" fill="#22d3ee"/>
      <path d="M560 80 H400 V240 H240" fill="none" stroke="#ff2bd6" stroke-width="8" stroke-linejoin="round"/>
      <polygon points="240,240 210,228 210,252" fill="#ff2bd6"/>
      <circle cx="420" cy="140" r="16" fill="#22d3ee" opacity="0.25"/>
      <circle cx="240" cy="240" r="16" fill="#ff2bd6" opacity="0.25"/>
    `,
  },
  {
    file: 'pong.svg',
    title: 'Pong++ cover',
    sky: ['#102033', '#061018'],
    glow: '#58a6ff',
    body: `
      <path d="M320 30 V370" stroke="#234" stroke-width="4" stroke-dasharray="14 12"/>
      <rect x="70" y="150" width="16" height="90" rx="6" fill="#e7f3ff"/>
      <rect x="554" y="170" width="16" height="70" rx="6" fill="#58a6ff"/>
      <rect x="554" y="250" width="16" height="40" rx="6" fill="#9ad0ff" opacity="0.7"/>
      <circle cx="300" cy="200" r="14" fill="#fff"/>
      <circle cx="360" cy="250" r="8" fill="#58a6ff"/>
      <circle cx="250" cy="180" r="6" fill="#fff" opacity="0.35"/>
      <circle cx="210" cy="168" r="4" fill="#fff" opacity="0.2"/>
    `,
  },
  {
    file: 'stacker.svg',
    title: 'Stacker cover',
    sky: ['#2a220f', '#120e08'],
    glow: '#f7c948',
    body: `
      <rect x="300" y="40" width="4" height="320" fill="#3a3018"/>
      <g>
        <rect x="150" y="300" width="340" height="36" rx="4" fill="#c48a22"/>
        <rect x="180" y="256" width="280" height="36" rx="4" fill="#e0a030"/>
        <rect x="210" y="212" width="220" height="36" rx="4" fill="#f0b840"/>
        <rect x="240" y="168" width="160" height="36" rx="4" fill="#f7c948"/>
        <rect x="270" y="124" width="100" height="36" rx="4" fill="#ffe08a"/>
      </g>
      <rect x="360" y="72" width="140" height="36" rx="4" fill="#fff4c8" stroke="#f7c948" stroke-width="2"/>
      <path d="M340 90 H360 M510 90 H530" stroke="#f7c948" stroke-width="3"/>
    `,
  },
  {
    file: 'crateescape.svg',
    title: 'Crate Escape cover',
    sky: ['#2a1c12', '#120e0a'],
    glow: '#f0883e',
    body: `
      <rect x="70" y="40" width="500" height="320" fill="#1a140e" stroke="#5a4030" stroke-width="10"/>
      <g fill="#3a2a1c">
        <rect x="110" y="70" width="70" height="70"/>
        <rect x="250" y="70" width="70" height="70"/>
        <rect x="460" y="70" width="70" height="70"/>
        <rect x="110" y="250" width="70" height="70"/>
        <rect x="390" y="250" width="70" height="70"/>
      </g>
      <g>
        <rect x="250" y="180" width="64" height="64" fill="#c4843a" stroke="#6b4a22" stroke-width="4"/>
        <path d="M250 212 H314 M282 180 V244" stroke="#6b4a22" stroke-width="3"/>
        <rect x="390" y="110" width="64" height="64" fill="#d7a15a" stroke="#6b4a22" stroke-width="4"/>
        <path d="M390 142 H454 M422 110 V174" stroke="#6b4a22" stroke-width="3"/>
      </g>
      <circle cx="196" cy="292" r="22" fill="none" stroke="#f0883e" stroke-width="4" stroke-dasharray="4 4"/>
      <circle cx="476" cy="196" r="22" fill="none" stroke="#f0883e" stroke-width="4" stroke-dasharray="4 4"/>
      <circle cx="186" cy="150" r="16" fill="#f2d7b0"/>
      <rect x="174" y="166" width="24" height="28" rx="4" fill="#58a6ff"/>
    `,
  },
  {
    file: 'vectordefense.svg',
    title: 'Vector Defense cover',
    sky: ['#16122c', '#0c0818'],
    glow: '#8b83ff',
    body: `
      <path d="M40 80 H200 V200 H400 V320 H600" fill="none" stroke="#2a2450" stroke-width="28" stroke-linejoin="round"/>
      <path d="M40 80 H200 V200 H400 V320 H600" fill="none" stroke="#3a3468" stroke-width="6" stroke-linejoin="round"/>
      <g>
        <circle cx="160" cy="140" r="22" fill="#1a1630" stroke="#8b83ff" stroke-width="3"/>
        <rect x="152" y="132" width="16" height="16" fill="#8b83ff"/>
        <circle cx="360" cy="240" r="22" fill="#1a1630" stroke="#22d3ee" stroke-width="3"/>
        <rect x="352" y="232" width="16" height="16" fill="#22d3ee"/>
        <circle cx="500" cy="300" r="22" fill="#1a1630" stroke="#f0c552" stroke-width="3"/>
        <rect x="492" y="292" width="16" height="16" fill="#f0c552"/>
      </g>
      <g fill="none" stroke="#f778ba" stroke-width="3">
        <polygon points="80,70 100,80 80,90"/>
        <polygon points="240,190 260,200 240,210"/>
        <polygon points="460,310 480,320 460,330"/>
      </g>
      <path d="M172 140 L230 190" stroke="#8b83ff" stroke-width="2"/>
      <path d="M372 250 L450 310" stroke="#22d3ee" stroke-width="2"/>
    `,
  },
  {
    file: 'wordcascade.svg',
    title: 'Word Cascade cover',
    sky: ['#10281c', '#07140e'],
    glow: '#3fb950',
    body: `
      <g font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="42" text-anchor="middle">
        <rect x="80" y="40" width="70" height="70" rx="10" fill="#14301c" stroke="#3fb950" stroke-width="3"/>
        <text x="115" y="88" fill="#d8ffe4">C</text>
        <rect x="220" y="90" width="70" height="70" rx="10" fill="#14301c" stroke="#7dff9a" stroke-width="3"/>
        <text x="255" y="138" fill="#d8ffe4">A</text>
        <rect x="360" y="50" width="70" height="70" rx="10" fill="#14301c" stroke="#3fb950" stroke-width="3"/>
        <text x="395" y="98" fill="#d8ffe4">S</text>
        <rect x="480" y="120" width="70" height="70" rx="10" fill="#14301c" stroke="#f0c552" stroke-width="3"/>
        <text x="515" y="168" fill="#fff4c8">T</text>
      </g>
      <g font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="36" text-anchor="middle">
        ${['P', 'L', 'A', 'Y'].map((ch, i) => `
          <rect x="${120 + i * 100}" y="270" width="80" height="72" rx="10" fill="#3fb950"/>
          <text x="${160 + i * 100}" y="318" fill="#06210e">${ch}</text>
        `).join('')}
      </g>
    `,
  },
  {
    file: 'memorymatrix.svg',
    title: 'Memory Matrix cover',
    sky: ['#1a1030', '#100818'],
    glow: '#a78bfa',
    body: `
      ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => {
        const lit = (r === 0 && c === 1) || (r === 1 && c === 3) || (r === 2 && c === 0) || (r === 3 && c === 2);
        const n = lit ? ['1', '2', '3', '4'][[`${r}${c}` === '01' ? 0 : `${r}${c}` === '13' ? 1 : `${r}${c}` === '20' ? 2 : 3]] : '';
        return `
          <rect x="${150 + c * 90}" y="${48 + r * 82}" width="74" height="66" rx="10" fill="${lit ? '#a78bfa' : '#241838'}" stroke="#3a2860"/>
          ${lit ? `<text x="${187 + c * 90}" y="${90 + r * 82}" fill="#1a1030" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="800" text-anchor="middle">${n}</text>` : ''}
        `;
      }).join('')).join('')}
    `,
  },
  {
    file: 'dropfour.svg',
    title: 'Drop Four cover',
    sky: ['#1a2744', '#101828'],
    glow: '#f7c948',
    body: `
      <rect x="120" y="50" width="400" height="300" rx="16" fill="#1d4e89"/>
      ${[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) =>
        `<circle cx="${162 + c * 54}" cy="${92 + r * 46}" r="16" fill="#0c1a30"/>`).join('')).join('')}
      <g>
        <circle cx="270" cy="276" r="16" fill="#e23b3b"/>
        <circle cx="324" cy="276" r="16" fill="#f7c948"/>
        <circle cx="378" cy="276" r="16" fill="#e23b3b"/>
        <circle cx="432" cy="276" r="16" fill="#f7c948"/>
        <circle cx="324" cy="230" r="16" fill="#e23b3b"/>
        <circle cx="378" cy="230" r="16" fill="#f7c948"/>
        <circle cx="378" cy="184" r="16" fill="#e23b3b"/>
      </g>
      <circle cx="486" cy="40" r="16" fill="#f7c948"/>
      <path d="M486 58 V70" stroke="#f7c948" stroke-width="3"/>
    `,
  },
  {
    file: 'word5.svg',
    title: 'Word Five cover',
    sky: ['#10281c', '#07140e'],
    glow: '#3fb950',
    body: `
      <g font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800" font-size="28" text-anchor="middle">
        ${[
          ['#3a4248', '#3a4248', '#3a4248', '#3a4248', '#3a4248'],
          ['#3fb950', '#3a4248', '#e3b341', '#3a4248', '#3fb950'],
          ['#3a4248', '#3fb950', '#3a4248', '#e3b341', '#3a4248'],
          ['#1c2420', '#1c2420', '#1c2420', '#1c2420', '#1c2420'],
          ['#1c2420', '#1c2420', '#1c2420', '#1c2420', '#1c2420'],
          ['#1c2420', '#1c2420', '#1c2420', '#1c2420', '#1c2420'],
        ].map((row, r) => row.map((fill, c) => {
          const letters = [
            ['S', 'T', 'A', 'R', 'E'],
            ['C', 'R', 'A', 'N', 'E'],
            ['B', 'R', 'A', 'I', 'D'],
            ['', '', '', '', ''],
            ['', '', '', '', ''],
            ['', '', '', '', ''],
          ];
          const ch = letters[r][c];
          return `
            <rect x="${120 + c * 84}" y="${36 + r * 58}" width="72" height="50" rx="6" fill="${fill}" stroke="#2a3a30"/>
            <text x="${156 + c * 84}" y="${70 + r * 58}" fill="${fill === '#1c2420' ? '#1c2420' : '#f4fff6'}">${ch}</text>
          `;
        }).join('')).join('')}
      </g>
    `,
  },
];

function svg(cover) {
  const [top, bottom] = cover.sky;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" role="img" aria-labelledby="title">
  <title id="title">${cover.title}</title>
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="${cover.glow}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${cover.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.62" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#sky)"/>
  <rect width="640" height="400" fill="url(#glow)"/>
  ${cover.body}
  <rect width="640" height="400" fill="url(#shade)"/>
</svg>
`;
}

for (const cover of covers) {
  writeFileSync(join(outDir, cover.file), svg(cover));
}
console.log(`wrote ${covers.length} covers`);
