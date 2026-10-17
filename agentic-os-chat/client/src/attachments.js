// Turns dropped / pasted / picked files into content blocks the API
// understands: images (downscaled to the model's sweet spot), PDFs as
// documents, and text-like files as text. Everything stays in the browser
// until it is sent to the local server.

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_DIM = 1568; // the API's recommended longest edge
const KEEP_ORIGINAL_UNDER = 1_500_000; // bytes: small originals are sent as-is
const MAX_PDF_BYTES = 15_000_000;
const MAX_TEXT_CHARS = 200_000;
const THUMB = 96;
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|sh|bash|zsh|yml|yaml|toml|ini|cfg|xml|html|htm|css|scss|sql|log|env\.example)$/i;

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function readAs(file, how) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("could not read file"));
    if (how === "dataURL") r.readAsDataURL(file);
    else if (how === "text") r.readAsText(file);
    else r.readAsArrayBuffer(file);
  });
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not decode image"));
    img.src = src;
  });
}

function draw(img, w, h, mime, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(mime, quality);
}

async function imageAttachment(file) {
  const original = await readAs(file, "dataURL");
  const img = await loadImage(original);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > MAX_IMAGE_DIM ? MAX_IMAGE_DIM / longest : 1;
  const tScale = Math.min(1, THUMB / Math.max(1, longest));
  const preview = draw(img, img.naturalWidth * tScale, img.naturalHeight * tScale, "image/jpeg", 0.8);
  let mime = file.type;
  let data;
  if (scale === 1 && file.size <= KEEP_ORIGINAL_UNDER) {
    data = dataUrlToBase64(original);
  } else {
    // Re-encode: JPEG for photos, PNG when the source had transparency (png/webp/gif).
    mime = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const url = draw(img, img.naturalWidth * scale, img.naturalHeight * scale, mime, 0.85);
    data = dataUrlToBase64(url);
    if (mime === "image/png" && data.length > 4_000_000) {
      mime = "image/jpeg";
      data = dataUrlToBase64(draw(img, img.naturalWidth * scale, img.naturalHeight * scale, mime, 0.85));
    }
  }
  return { id: uid(), kind: "image", name: file.name || "image", mime, size: Math.round((data.length * 3) / 4), data, preview };
}

async function pdfAttachment(file) {
  if (file.size > MAX_PDF_BYTES) throw new Error(`${file.name}: PDFs up to 15 MB only`);
  const data = dataUrlToBase64(await readAs(file, "dataURL"));
  return { id: uid(), kind: "pdf", name: file.name || "document.pdf", mime: "application/pdf", size: file.size, data };
}

async function textAttachment(file) {
  let text = await readAs(file, "text");
  if (text.includes("�") && !/^text\//.test(file.type)) throw new Error(`${file.name}: not a text file`);
  let truncated = false;
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    truncated = true;
  }
  return { id: uid(), kind: "text", name: file.name || "file.txt", mime: file.type || "text/plain", size: file.size, text, truncated };
}

export async function fileToAttachment(file) {
  if (IMAGE_TYPES.has(file.type)) return imageAttachment(file);
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) return pdfAttachment(file);
  if (/^text\//.test(file.type) || TEXT_EXT.test(file.name || "") || file.type === "application/json") return textAttachment(file);
  if (!file.type && file.size < 300_000) return textAttachment(file);
  throw new Error(`${file.name || "file"}: unsupported type (${file.type || "unknown"}). Images, PDFs and text files work.`);
}

// The API content for one user turn: attachments first, then the text.
export function blocksFor(attachments, text) {
  const blocks = [];
  for (const a of attachments) {
    if (a.kind === "image") blocks.push({ type: "image", source: { type: "base64", media_type: a.mime, data: a.data } });
    else if (a.kind === "pdf") blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
    else if (a.kind === "text") blocks.push({ type: "text", text: `Attached file: ${a.name}${a.truncated ? " (truncated)" : ""}\n\n${a.text}` });
  }
  blocks.push({ type: "text", text });
  return blocks;
}

// What the conversation keeps for display: names, kinds, thumbnails only.
export function summaryOf(attachments) {
  return attachments.map(({ id, kind, name, size, preview }) => ({ id, kind, name, size, preview }));
}

export function formatBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
