import type { CompanionId } from "../shared/types";

const PLATE: Record<string, string> = {
  mara: `
    <rect width="80" height="80" fill="#24160f"/>
    <path d="M6 80c8-24 18-34 34-34s26 10 34 34" fill="#c45c26"/>
    <path d="M24 80c3-12 8-18 16-18s13 6 16 18" fill="#8b3a18"/>
    <rect x="34" y="50" width="12" height="8" fill="#e7c2a4"/>
    <ellipse cx="40" cy="36" rx="14" ry="16" fill="#f0d2b4"/>
    <path d="M26 34c1-16 8-24 14-24s13 8 14 22c-4-8-8-11-14-11s-10 3-14 13z" fill="#1a0e0a"/>
    <path d="M27 33c5-7 21-8 26 1-7-4-19-4-26-1z" fill="#1a0e0a"/>
    <path d="M30 33l7-1M43 32l7 1" fill="none" stroke="#1a0e0a" stroke-width="1.3" stroke-linecap="round"/>
    <ellipse cx="34" cy="38" rx="2" ry="2.3" fill="#1a140f"/>
    <ellipse cx="47" cy="38" rx="2" ry="2.3" fill="#1a140f"/>
    <circle cx="34.7" cy="37.3" r="0.6" fill="#fff6e8"/>
    <circle cx="47.7" cy="37.3" r="0.6" fill="#fff6e8"/>
    <path d="M35 48q5 3 10 0" fill="none" stroke="#8a4030" stroke-width="1.3" stroke-linecap="round"/>
    <circle cx="58" cy="66" r="6" fill="#e3b341"/>
    <path d="M58 62v8M54 66h8" stroke="#24160f" stroke-width="1.3"/>
  `,
  ivo: `
    <rect width="80" height="80" fill="#2a261f"/>
    <path d="M8 80c6-22 16-32 32-32s26 10 32 32" fill="#f4efe4"/>
    <path d="M22 80c3-12 9-18 18-18s15 6 18 18" fill="#d9d0c2"/>
    <rect x="35" y="50" width="10" height="8" fill="#f3d7b8"/>
    <ellipse cx="40" cy="37" rx="13" ry="15" fill="#f6e0c4"/>
    <path d="M27 34c2-16 8-22 13-22s11 6 13 20c-4-7-8-9-13-9s-9 2-13 11z" fill="#5c3b22"/>
    <ellipse cx="33.5" cy="39" rx="1.7" ry="2.1" fill="#1a140f"/>
    <ellipse cx="46.5" cy="39" rx="1.7" ry="2.1" fill="#1a140f"/>
    <circle cx="40" cy="39" r="7.2" fill="none" stroke="#e3b341" stroke-width="1.5"/>
    <circle cx="33.5" cy="39" r="4.2" fill="none" stroke="#e3b341" stroke-width="1.4"/>
    <circle cx="46.5" cy="39" r="4.2" fill="none" stroke="#e3b341" stroke-width="1.4"/>
    <path d="M37.6 39h4.8" stroke="#e3b341" stroke-width="1.4"/>
    <path d="M36 48q4 2.4 8 0" fill="none" stroke="#8a4030" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M58 22c8 1 10 8 6 12" fill="none" stroke="#e3b341" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M64 34l3 16" stroke="#8b83ff" stroke-width="1.8" stroke-linecap="round"/>
  `,
  sable: `
    <rect width="80" height="80" fill="#141816"/>
    <circle cx="40" cy="36" r="24" fill="#e4b15c" opacity="0.28"/>
    <path d="M8 80c6-20 16-30 32-30s26 10 32 30" fill="#1c3330"/>
    <path d="M28 62h24l-3 10H31z" fill="#c9a15a"/>
    <rect x="36" y="50" width="8" height="8" fill="#f3c99a"/>
    <ellipse cx="40" cy="36" rx="13" ry="15" fill="#f6d2a8"/>
    <path d="M27 34c2-14 8-20 13-20s11 6 13 18c-4-6-8-8-13-8s-9 2-13 10z" fill="#2a2118"/>
    <path d="M28 32c4-6 20-7 24 1-6-3-18-3-24-1z" fill="#2a2118"/>
    <ellipse cx="34" cy="38" rx="2.1" ry="2.4" fill="#fff4d2"/>
    <ellipse cx="47" cy="38" rx="2.1" ry="2.4" fill="#fff4d2"/>
    <circle cx="34" cy="38" r="1" fill="#c45c26"/>
    <circle cx="47" cy="38" r="1" fill="#c45c26"/>
    <path d="M35 48q5 3 10 0" fill="none" stroke="#8a4030" stroke-width="1.3" stroke-linecap="round"/>
    <g transform="translate(54 54)">
      <rect x="4" y="0" width="6" height="5" rx="1" fill="#8a6a32"/>
      <path d="M2 5h10l-1 12H3z" fill="#c9a15a"/>
      <ellipse cx="7" cy="12" rx="2.2" ry="3" fill="#fff4d2"/>
    </g>
  `,
  bram: `
    <rect width="80" height="80" fill="#0e2c34"/>
    <path d="M8 80c6-22 16-30 32-30s26 8 32 30" fill="#1f6f78"/>
    <ellipse cx="40" cy="40" rx="14" ry="15" fill="#e7c2a4"/>
    <path d="M24 28h32v8H24z" fill="#123840"/>
    <path d="M18 28h44v4H18z" fill="#e3b341"/>
    <path d="M26 36c2-10 8-16 14-16s12 6 14 16v6H26z" fill="#123840"/>
    <ellipse cx="34" cy="42" rx="1.8" ry="2.2" fill="#1a140f"/>
    <ellipse cx="46" cy="42" rx="1.8" ry="2.2" fill="#1a140f"/>
    <path d="M34 50q6 3 12 0" fill="none" stroke="#5c3b22" stroke-width="1.3"/>
  `,
  ness: `
    <rect width="80" height="80" fill="#123840"/>
    <path d="M10 80c6-22 16-32 30-32s24 10 30 32" fill="#e07a45"/>
    <ellipse cx="40" cy="38" rx="14" ry="16" fill="#f0d2b4"/>
    <path d="M26 34c2-16 8-22 14-22 6 0 10 4 12 14-6-6-10-8-14-8s-8 3-12 16z" fill="#3a2418"/>
    <path d="M50 16c6-2 10 2 10 8-6 0-10-2-10-8z" fill="#3a2418"/>
    <ellipse cx="34" cy="40" rx="1.8" ry="2.2" fill="#1a140f"/>
    <ellipse cx="46" cy="40" rx="1.8" ry="2.2" fill="#1a140f"/>
    <path d="M35 50q5 3 10 0" fill="none" stroke="#8a4030" stroke-width="1.2"/>
    <path d="M56 54l10 8-8 2z" fill="#9fd7ff" stroke="#e3b341" stroke-width="1"/>
  `,
  pell: `
    <rect width="80" height="80" fill="#062833"/>
    <path d="M6 66c12-10 20-8 30 2s20 10 32 0 14-8 18 2v14H6z" fill="#1f6f78"/>
    <ellipse cx="40" cy="46" rx="16" ry="18" fill="#e3b341"/>
    <path d="M28 46h24" stroke="#10131a" stroke-width="2.4"/>
    <ellipse cx="34" cy="48" rx="1.8" ry="2.2" fill="#10131a"/>
    <ellipse cx="46" cy="48" rx="1.8" ry="2.2" fill="#10131a"/>
    <path d="M35 56q5 3 10 0" fill="none" stroke="#10131a" stroke-width="1.3"/>
    <path d="M34 18h12l2 8H32z" fill="#f6f3ea"/>
    <rect x="38" y="8" width="4" height="12" fill="#8b83ff"/>
  `
};

export function portrait(id: CompanionId, name: string): string {
  const label = escapeAttr(name);
  const inner = PLATE[id] || PLATE.sable;
  return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}">${inner}</svg>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}
