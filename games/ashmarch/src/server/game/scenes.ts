import type { SceneBrief } from "../../shared/types";

function plate(sky0: string, sky1: string, ground: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640" role="img">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${sky0}"/>
      <stop offset="100%" stop-color="${sky1}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="640" fill="url(#sky)"/>
  <rect y="460" width="1200" height="180" fill="${ground}"/>
  ${body}
</svg>`;
}

function party(x: number, y: number): string {
  return `
    <g fill="#1a140f">
      <circle cx="${x}" cy="${y - 28}" r="9"/>
      <path d="M${x - 14} ${y + 18} l8 -24 h12 l8 24z"/>
      <circle cx="${x + 36}" cy="${y - 30}" r="9"/>
      <path d="M${x + 22} ${y + 18} l8 -26 h12 l8 26z"/>
      <circle cx="${x + 70}" cy="${y - 18}" r="6" fill="#e4b15c"/>
      <rect x="${x + 67}" y="${y - 10}" width="6" height="22" fill="#8a6a32"/>
    </g>`;
}

function waystation(): string {
  return plate(
    "#2a1b16",
    "#c47a45",
    "#231910",
    `
    <circle cx="180" cy="120" r="36" fill="#f0d2a4" opacity="0.85"/>
    <g fill="#1a120e">
      <polygon points="150,300 430,210 760,300"/>
      <rect x="210" y="300" width="470" height="190"/>
      <rect x="250" y="340" width="70" height="54" fill="#e4b15c"/>
      <rect x="360" y="340" width="70" height="54" fill="#1a120e" stroke="#e4b15c" stroke-width="6"/>
      <rect x="530" y="360" width="54" height="130" fill="#3a2418"/>
    </g>
    <rect x="860" y="250" width="14" height="210" fill="#1a120e"/>
    <circle cx="867" cy="236" r="28" fill="#e4b15c"/>
    <circle cx="867" cy="236" r="12" fill="#fff4d2"/>
    ${party(760, 500)}
    <g fill="#f0e6d4" opacity="0.45">
      <circle cx="120" cy="180" r="2"/><circle cx="240" cy="90" r="1.5"/><circle cx="980" cy="140" r="2"/>
      <circle cx="1040" cy="220" r="1.5"/><circle cx="80" cy="300" r="1.4"/><circle cx="700" cy="80" r="1.6"/>
    </g>`,
  );
}

function bridge(): string {
  return plate(
    "#1c2430",
    "#d9c7a4",
    "#14181f",
    `
    <circle cx="980" cy="110" r="42" fill="#f4efe2"/>
    <rect x="0" y="430" width="1200" height="90" fill="#07080c"/>
    <path d="M80 470 Q600 250 1120 470" fill="none" stroke="#efe6d4" stroke-width="28"/>
    <path d="M80 470 Q600 330 1120 470" fill="none" stroke="#1c2430" stroke-width="8"/>
    <g fill="#efe6d4">
      <rect x="560" y="250" width="46" height="18"/>
      <rect x="572" y="232" width="34" height="18"/>
      <rect x="584" y="214" width="22" height="18"/>
      <rect x="590" y="196" width="14" height="18"/>
    </g>
    <rect x="586" y="188" width="22" height="14" fill="#c45c26"/>
    ${party(300, 430)}
    `,
  );
}

function flats(): string {
  return plate(
    "#8a6a48",
    "#ead7b8",
    "#cbb892",
    `
    <ellipse cx="300" cy="470" rx="280" ry="48" fill="#e6d3b0"/>
    <ellipse cx="820" cy="490" rx="340" ry="60" fill="#d7c09a"/>
    <g fill="none" stroke="#f7f1e4" stroke-width="10">
      <path d="M470 470 C500 300 560 300 590 470"/>
      <path d="M540 470 C570 250 650 250 690 470"/>
      <path d="M640 470 C670 280 740 280 780 470"/>
      <path d="M730 470 C760 320 820 320 850 470"/>
    </g>
    <circle cx="1040" cy="150" r="30" fill="#f2e2c4" opacity="0.7"/>
    ${party(180, 500)}
    `,
  );
}

function market(): string {
  return plate(
    "#4a2e2a",
    "#e6d3bf",
    "#2a1d18",
    `
    <g>
      <rect x="120" y="330" width="150" height="140" fill="#1a120e"/>
      <polygon points="90,330 195,250 300,330" fill="#a33b32"/>
      <rect x="360" y="350" width="170" height="120" fill="#1a120e"/>
      <polygon points="330,350 445,270 560,350" fill="#8d3d34"/>
      <rect x="640" y="320" width="150" height="150" fill="#1a120e"/>
      <polygon points="610,320 715,230 820,320" fill="#c45c26"/>
    </g>
    <path d="M900 470 v-150 h70 l-10 40 h-30 v110z" fill="#d9cbb8"/>
    <path d="M930 340 h30 v26 h-30z" fill="#1a120e"/>
    <path d="M910 390 h18 v18 h-18z M940 390 h18 v18 h-18z" fill="#1a120e"/>
    ${party(240, 510)}
    `,
  );
}

function scriptorium(): string {
  return plate(
    "#0e2a28",
    "#7fbfb2",
    "#123430",
    `
    <g fill="#163e3a" stroke="#d7efe8" stroke-width="6">
      <path d="M160 470 V250 h40 a80 80 0 0 1 160 0 h40 V470"/>
      <path d="M500 470 V230 h40 a90 90 0 0 1 180 0 h40 V470"/>
      <path d="M860 470 V270 h30 a60 60 0 0 1 120 0 h30 V470"/>
    </g>
    <rect y="390" width="1200" height="250" fill="#1c6b62" opacity="0.55"/>
    <rect x="560" y="340" width="90" height="14" fill="#e7dcc7"/>
    <rect x="596" y="354" width="18" height="50" fill="#e7dcc7"/>
    <path d="M575 330 h60 v16 h-60z" fill="#f4efe2"/>
    `,
  );
}

function bellcrypt(): string {
  return plate(
    "#120e16",
    "#2a2030",
    "#100c12",
    `
    <g fill="#c9a15a">
      <path d="M180 120 h16 v40 a70 70 0 0 0 140 0 v-40 h16 v46 a90 90 0 0 1 -172 0z"/>
      <path d="M470 90 h16 v50 a80 80 0 0 0 160 0 v-50 h16 v56 a100 100 0 0 1 -192 0z"/>
      <path d="M820 140 h14 v36 a60 60 0 0 0 120 0 v-36 h14 v42 a78 78 0 0 1 -148 0z"/>
    </g>
    <g fill="#f0d78a">
      <rect x="230" y="210" width="16" height="10"/>
      <rect x="530" y="200" width="22" height="12"/>
      <rect x="560" y="220" width="10" height="16"/>
      <rect x="860" y="230" width="14" height="9"/>
    </g>
    <path d="M600 470 l-20 -40 h40z" fill="#e7dcc7"/>
    `,
  );
}

function ending(kind: SceneBrief["ending"]): string {
  if (kind === "mercy") {
    return plate(
      "#16141c",
      "#3a342c",
      "#12100e",
      `
      <path d="M360 480 V220 h80 a160 160 0 0 1 320 0 h80 V480z" fill="#1a1714" stroke="#e7dcc7" stroke-width="8"/>
      <rect x="560" y="300" width="80" height="180" fill="#0e0c0a"/>
      <circle cx="620" cy="250" r="18" fill="#8a6a32"/>
      <rect x="500" y="250" width="240" height="16" fill="#c45c26"/>
      ${party(180, 500)}
      `,
    );
  }
  if (kind === "kept") {
    return plate(
      "#1a140e",
      "#6a4a2a",
      "#1a140f",
      `
      <circle cx="600" cy="300" r="150" fill="#e4b15c"/>
      <circle cx="600" cy="300" r="108" fill="#fff1c9"/>
      <g fill="#1a140f">
        <rect x="540" y="250" width="28" height="40"/>
        <rect x="580" y="230" width="18" height="60"/>
        <rect x="610" y="260" width="34" height="28"/>
        <polygon points="560,310 600,270 650,320 610,340"/>
      </g>
      <rect x="588" y="450" width="24" height="70" fill="#8a6a32"/>
      ${party(250, 510)}
      `,
    );
  }
  return plate(
    "#3a2418",
    "#f0c48a",
    "#2a1c14",
    `
    <g fill="#1a120e">
      <rect x="140" y="300" width="120" height="180"/>
      <rect x="290" y="250" width="90" height="230"/>
      <rect x="410" y="280" width="160" height="200"/>
      <rect x="600" y="230" width="80" height="250"/>
      <rect x="710" y="310" width="140" height="170"/>
      <rect x="880" y="260" width="110" height="220"/>
    </g>
    <g fill="#e4b15c">
      <rect x="170" y="330" width="22" height="16"/><rect x="210" y="360" width="22" height="16"/>
      <rect x="450" y="320" width="26" height="18"/><rect x="500" y="360" width="26" height="18"/>
      <rect x="630" y="280" width="18" height="14"/><rect x="750" y="350" width="22" height="16"/>
      <rect x="910" y="300" width="20" height="14"/><rect x="950" y="340" width="20" height="14"/>
    </g>
    ${party(80, 500)}
    `,
  );
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weather(scene: SceneBrief): string {
  let s = hash(`${scene.bookId ?? "ashmarch"}|${scene.location}|${scene.mood}|${scene.ending ?? ""}`) || 1;
  const rand = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const tint = scene.bookId === "lumenferry" ? "#d7fff6" : "#f6e7c8";
  const stars = Array.from({ length: 18 }, () => {
    const x = Math.round(rand() * 1160 + 16);
    const y = Math.round(rand() * 200 + 12);
    const r = (rand() * 1.7 + 0.45).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${tint}"/>`;
  }).join("");
  const moonX = Math.round(90 + rand() * 960);
  const moonY = Math.round(46 + rand() * 80);
  const drift = Array.from({ length: 8 }, () => {
    const x = Math.round(rand() * 1100 + 40);
    const y = Math.round(340 + rand() * 180);
    return `<circle cx="${x}" cy="${y}" r="${(rand() * 2.2 + 0.6).toFixed(2)}" fill="${tint}" opacity="0.35"/>`;
  }).join("");
  return `<g opacity="0.9">${stars}<circle cx="${moonX}" cy="${moonY}" r="28" fill="${tint}"/><circle cx="${moonX + 14}" cy="${moonY - 6}" r="22" fill="#100e0c" opacity="0.38"/>${drift}</g>`;
}

function shrine(): string {
  return plate(
    "#24160f",
    "#c9a27a",
    "#1a120e",
    `
    <path d="M80 500 L520 210 L560 210 L1040 500" fill="#3a2a22"/>
    <rect x="470" y="250" width="220" height="150" fill="#6d5846"/>
    <rect x="500" y="280" width="160" height="90" fill="#1a120e"/>
    <g fill="#e7d7bc" font-size="0">
      <rect x="518" y="298" width="28" height="6"/>
      <rect x="556" y="312" width="40" height="6"/>
      <rect x="520" y="328" width="22" height="6"/>
      <rect x="560" y="342" width="36" height="6" fill="#e4b15c"/>
    </g>
    <path d="M80 470 Q600 390 1120 470" fill="none" stroke="#efe6d4" stroke-width="10" opacity="0.4"/>
    ${party(180, 500)}
    `,
  );
}

function orchard(): string {
  return plate(
    "#6e5a48",
    "#efe2cf",
    "#cbb892",
    `
    <g fill="none" stroke="#f7f1e4" stroke-width="8">
      <path d="M180 490 C200 300 280 280 300 490"/>
      <path d="M420 490 C450 240 560 240 590 490"/>
      <path d="M760 490 C790 260 900 270 930 490"/>
    </g>
    <g fill="#f4efe8">
      <circle cx="250" cy="360" r="7"/><circle cx="500" cy="330" r="8"/><circle cx="540" cy="360" r="6"/>
      <circle cx="850" cy="340" r="8" fill="#e7d2a8"/>
    </g>
    <path d="M120 180 q20 30 0 50 q20 -10 0 -50" fill="none" stroke="#f7f1e4" opacity="0.6"/>
    ${party(140, 510)}
    `,
  );
}

function choir(): string {
  return plate(
    "#140e16",
    "#3a2a38",
    "#120c12",
    `
    <path d="M160 500 L430 180 h40 L700 500" fill="#2a2030"/>
    <g fill="#c9a15a">
      <path d="M300 220 h8 v20 a28 28 0 0 0 56 0 v-20 h8 v24 a40 40 0 0 1 -72 0z"/>
      <path d="M430 250 h8 v16 a22 22 0 0 0 44 0 v-16 h8 v20 a32 32 0 0 1 -60 0z"/>
    </g>
    <rect x="470" y="360" width="18" height="140" fill="#e7dcc7"/>
    ${party(760, 500)}
    `,
  );
}

function quay(): string {
  return plate(
    "#071820",
    "#1f6f78",
    "#041016",
    `
    <rect x="860" y="80" width="36" height="360" fill="#d7fff6"/>
    <polygon points="848,80 908,80 890,20 866,20" fill="#0b3a44"/>
    <circle cx="878" cy="150" r="18" fill="#062833" stroke="#d7fff6" stroke-width="4"/>
    <path d="M40 430 h1120" stroke="#14343c" stroke-width="8"/>
    <path d="M180 470 q80 -30 160 0 q80 30 160 0 q80 -30 160 0" fill="none" stroke="#7ec8c3" stroke-width="6" opacity="0.7"/>
    <path d="M120 500 h280 l40 -40 h-240 z" fill="#123840"/>
    <rect x="150" y="450" width="16" height="50" fill="#d7fff6"/>
    ${party(420, 490)}
    `,
  );
}

function causeway(): string {
  return plate(
    "#062028",
    "#9fd7ff",
    "#07141c",
    `
    <rect y="430" width="1200" height="80" fill="#02080c"/>
    <g fill="#d7fff8" opacity="0.85">
      <polygon points="80,470 280,390 340,470"/>
      <polygon points="360,470 560,360 640,470"/>
      <polygon points="660,470 860,380 940,470"/>
      <polygon points="960,470 1120,410 1160,470"/>
    </g>
    <g fill="none" stroke="#7ec8c3" stroke-width="3" opacity="0.8">
      <path d="M100 440 q40 -20 80 0"/><path d="M400 420 q50 -24 90 0"/><path d="M700 430 q40 -16 70 0"/>
    </g>
    <rect x="1040" y="120" width="28" height="280" fill="#d7fff6" opacity="0.5"/>
    ${party(200, 450)}
    `,
  );
}

function eelbeds(): string {
  return plate(
    "#042028",
    "#1a4a44",
    "#06302a",
    `
    <g fill="#0e4a40">
      <path d="M40 470 q30 -80 10 -140 q20 40 0 140"/>
      <path d="M120 480 q40 -120 16 -200 q24 60 0 200"/>
      <path d="M220 470 q24 -70 8 -120 q16 30 0 120"/>
      <path d="M900 480 q36 -110 12 -180 q20 50 0 180"/>
      <path d="M1000 470 q30 -90 10 -150 q18 40 0 150"/>
    </g>
    <path d="M300 420 C420 360 520 460 680 400" fill="none" stroke="#9fd7c8" stroke-width="8"/>
    <path d="M360 450 C480 500 600 390 760 460" fill="none" stroke="#d7fff6" stroke-width="5" opacity="0.7"/>
    <circle cx="640" cy="430" r="22" fill="#c9a15a"/>
    <path d="M628 430 h24" stroke="#1a140f" stroke-width="3"/>
    ${party(160, 500)}
    `,
  );
}

function lenshouse(): string {
  return plate(
    "#07141c",
    "#245868",
    "#0c1c22",
    `
    <circle cx="620" cy="300" r="170" fill="#d7fff6" opacity="0.18" stroke="#d7fff6" stroke-width="10"/>
    <circle cx="620" cy="300" r="90" fill="none" stroke="#9fd7ff" stroke-width="6"/>
    <circle cx="620" cy="300" r="8" fill="#f2c14e"/>
    <rect x="180" y="360" width="220" height="140" fill="#0e2c34"/>
    <polygon points="160,360 290,250 420,360" fill="#123840"/>
    <rect x="860" y="160" width="40" height="340" fill="#d7fff6" opacity="0.35"/>
    ${party(240, 500)}
    `,
  );
}

function kiln(): string {
  return plate(
    "#1a120e",
    "#3a2418",
    "#140e0c",
    `
    <path d="M360 500 V240 h80 a140 160 0 0 1 280 0 h80 V500" fill="#2a1c16" stroke="#e07a45" stroke-width="8"/>
    <ellipse cx="600" cy="430" rx="90" ry="28" fill="#e07a45" opacity="0.85"/>
    <ellipse cx="600" cy="430" rx="40" ry="12" fill="#f2c14e"/>
    <g fill="#9fd7ff" opacity="0.55">
      <ellipse cx="180" cy="390" rx="30" ry="46"/>
      <ellipse cx="980" cy="370" rx="24" ry="40"/>
      <ellipse cx="1040" cy="420" rx="18" ry="28"/>
    </g>
    <rect x="560" y="200" width="80" height="12" fill="#e7dcc7"/>
    `,
  );
}

function bellpool(): string {
  return plate(
    "#06141c",
    "#1f6f78",
    "#041018",
    `
    <ellipse cx="600" cy="420" rx="340" ry="90" fill="#0e3a44"/>
    <ellipse cx="600" cy="420" rx="220" ry="48" fill="#14343c"/>
    <circle cx="600" cy="400" r="36" fill="#c9a15a"/>
    <path d="M588 400 h24 M600 386 v28" stroke="#1a140f" stroke-width="3"/>
    <path d="M520 250 h12 v30 a40 40 0 0 0 80 0 v-30 h12 v34 a54 54 0 0 1 -104 0z" fill="#d7fff6" opacity="0.8"/>
    <rect x="980" y="80" width="26" height="300" fill="#d7fff6" opacity="0.4"/>
    ${party(180, 470)}
    `,
  );
}

function ferryEnding(kind: SceneBrief["ending"]): string {
  if (kind === "relit") {
    return plate(
      "#071820",
      "#d7fff6",
      "#062028",
      `
      <rect x="860" y="40" width="34" height="420" fill="#f4efe2"/>
      <polygon points="150,470 878,120 980,470" fill="#f2c14e" opacity="0.35"/>
      <circle cx="878" cy="150" r="22" fill="#fff6d8"/>
      <path d="M80 500 h260 l30 -36 h-220 z" fill="#123840"/>
      <path d="M420 510 h180 l20 -24 h-150 z" fill="#0e2c34"/>
      ${party(180, 490)}
      `,
    );
  }
  if (kind === "held") {
    return plate(
      "#07141c",
      "#245868",
      "#041016",
      `
      <circle cx="620" cy="330" r="150" fill="#1f6f78"/>
      <circle cx="620" cy="330" r="108" fill="#d7fff6"/>
      <g fill="#062833">
        <rect x="560" y="280" width="22" height="40"/>
        <rect x="600" y="250" width="16" height="70"/>
        <rect x="640" y="290" width="30" height="28"/>
      </g>
      <circle cx="620" cy="470" r="28" fill="#c9a15a"/>
      ${party(220, 510)}
      `,
    );
  }
  return plate(
    "#041016",
    "#0e2c34",
    "#02080c",
    `
    <rect x="900" y="70" width="30" height="400" fill="#0e2c34" stroke="#1f6f78" stroke-width="4"/>
    <circle cx="915" cy="150" r="16" fill="#062028" stroke="#1f6f78" stroke-width="3"/>
    <path d="M80 490 h240 l28 -30 h-200 z" fill="#0b1c24"/>
    <path d="M400 500 h160 l16 -20 h-130 z" fill="#102830"/>
    <path d="M640 505 h120 l12 -16 h-100 z" fill="#0b1c24"/>
    ${party(160, 480)}
    `,
  );
}

function wight(): string {
  return plate(
    "#3a2a22",
    "#c47a45",
    "#d9d2c3",
    `
    <ellipse cx="620" cy="430" rx="220" ry="70" fill="#efe6d4"/>
    <path d="M430 390 l70 -150 40 90 80 -170 50 140 90 -80 30 170z" fill="#f4f0e6" stroke="#2a2118" stroke-width="6"/>
    <circle cx="760" cy="250" r="34" fill="#1a140f"/>
    <path d="M740 246 h12 M770 246 h12" stroke="#e4b15c" stroke-width="4"/>
    <path d="M500 470 q120 40 240 0" fill="none" stroke="#8a6a32" stroke-width="8"/>
    ${party(180, 500)}
    `,
  );
}

function boarding(): string {
  return plate(
    "#062833",
    "#1f6f78",
    "#04161c",
    `
    <path d="M80 470 h1040" stroke="#9fd7ff" stroke-width="6" opacity="0.45"/>
    <path d="M640 360 l220 40 -30 70 -180 10z" fill="#102830" stroke="#d7fff6" stroke-width="4"/>
    <path d="M700 300 v70 M760 280 v90 M820 310 v60" stroke="#c9a15a" stroke-width="6"/>
    <circle cx="900" cy="120" r="26" fill="#062028" stroke="#9fd7ff" stroke-width="4"/>
    ${party(220, 470)}
    `,
  );
}

function drawScene(scene: SceneBrief): string {
  if (scene.bookId === "lumenferry" && scene.location === "ending") return ferryEnding(scene.ending);
  switch (scene.location) {
    case "waystation":
      return waystation();
    case "bridge":
      return bridge();
    case "flats":
      return flats();
    case "market":
      return market();
    case "scriptorium":
      return scriptorium();
    case "bellcrypt":
      return bellcrypt();
    case "shrine":
      return shrine();
    case "orchard":
      return orchard();
    case "choir":
      return choir();
    case "wight":
      return wight();
    case "quay":
      return quay();
    case "causeway":
      return causeway();
    case "eelbeds":
      return eelbeds();
    case "lenshouse":
      return lenshouse();
    case "kiln":
      return kiln();
    case "bellpool":
      return bellpool();
    case "boarding":
      return boarding();
    case "ending":
      return ending(scene.ending);
    default:
      return waystation();
  }
}

export function renderScene(scene: SceneBrief): string {
  const book = scene.bookId ?? "ashmarch";
  const drawn = drawScene(scene).replace("<svg ", `<svg data-book="${book}" `);
  return drawn.replace("</svg>", `${weather(scene)}</svg>`);
}
