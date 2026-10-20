import type { CompanionId } from "../shared/types";

export function portrait(id: CompanionId, name: string): string {
  const label = escapeAttr(name);
  if (id === "mara") {
    return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}"><rect width="80" height="80" fill="#3a241c"/><circle cx="40" cy="34" r="16" fill="#e7c2a4"/><path d="M18 74c4-16 14-24 22-24s18 8 22 24" fill="#c45c26"/><path d="M24 30c2-14 30-16 34-2-8-8-26-8-34 2z" fill="#2a160f"/><path d="M32 36h4M46 36h4" stroke="#2a160f" stroke-width="1.6"/></svg>`;
  }
  if (id === "ivo") {
    return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}"><rect width="80" height="80" fill="#3a3228"/><circle cx="40" cy="34" r="16" fill="#f0d7b8"/><path d="M16 76c6-18 14-26 24-26s18 8 24 26" fill="#e7dcc7"/><path d="M22 28c6-12 30-12 36 0-4-6-32-6-36 0z" fill="#5c3b22"/><rect x="26" y="34" width="28" height="8" rx="4" fill="none" stroke="#1a140f" stroke-width="1.6"/><path d="M40 34v8" stroke="#1a140f" stroke-width="1.4"/></svg>`;
  }
  if (id === "bram") {
    return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}"><rect width="80" height="80" fill="#0e2c34"/><circle cx="40" cy="36" r="15" fill="#e7c2a4"/><path d="M18 74c4-16 14-22 22-22s18 6 22 22" fill="#1f6f78"/><path d="M22 30c4-12 32-12 36 2-10-8-26-8-36-2z" fill="#102028"/><path d="M18 28h44" stroke="#d7fff6" stroke-width="3"/><path d="M30 38h3M47 38h3" stroke="#1a140f" stroke-width="1.6"/></svg>`;
  }
  if (id === "ness") {
    return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}"><rect width="80" height="80" fill="#123840"/><circle cx="40" cy="36" r="15" fill="#f0d2b4"/><path d="M16 76c6-18 14-24 24-24s18 6 24 24" fill="#e07a45"/><path d="M24 28c2-14 30-16 34 0-8-10-26-10-34 0z" fill="#3a2418"/><circle cx="58" cy="50" r="8" fill="#9fd7ff" opacity="0.9"/><path d="M32 38h3M46 38h3" stroke="#1a140f" stroke-width="1.6"/></svg>`;
  }
  if (id === "pell") {
    return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}"><rect width="80" height="80" fill="#062833"/><circle cx="40" cy="46" r="18" fill="#c9a15a"/><path d="M28 46h24M40 34v24" stroke="#1a140f" stroke-width="2"/><path d="M30 18h20l3 10H27z" fill="#d7fff6"/><rect x="37" y="8" width="6" height="12" fill="#9fd7ff"/><path d="M22 70c6-10 30-10 36 0" fill="#1f6f78"/></svg>`;
  }
  return `<svg class="portrait" viewBox="0 0 80 80" role="img" aria-label="${label}"><rect width="80" height="80" fill="#1c3332"/><path d="M28 18h24l4 14H24z" fill="#8a6a32"/><rect x="36" y="8" width="8" height="12" fill="#c9a15a"/><path d="M24 32h32l-4 30H28z" fill="#12302e"/><ellipse cx="40" cy="46" rx="10" ry="14" fill="#e4b15c"/><ellipse cx="40" cy="44" rx="4" ry="6" fill="#fff4d2"/><path d="M30 62h20" stroke="#8fd0c8" stroke-width="2"/></svg>`;
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
