/**
 * Upload restrictions for evidence files. The content type is derived from
 * the (allow-listed) extension and cross-checked with magic bytes, never
 * taken from the browser. Executables, scripts and HTML are refused.
 */
export const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  log: "text/plain",
  csv: "text/csv",
  json: "application/json",
  eml: "message/rfc822",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_EXTENSIONS)
  .map((e) => `.${e}`)
  .join(",");

export function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return match?.[1] ?? "";
}

/** Keeps letters, digits, dot, dash, underscore; collapses the rest. */
export function sanitizeFilename(filename: string): string {
  const base = filename.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "");
  return (base || "file").slice(-120);
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

/** Magic-byte check for binary formats; text formats must not contain NUL bytes. */
export function contentMatchesExtension(ext: string, bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, 16);
  switch (ext) {
    case "pdf":
      return startsWith(head, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case "png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47]);
    case "jpg":
    case "jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case "webp":
      return startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.subarray(8, 12), [0x57, 0x45, 0x42, 0x50]);
    case "docx":
    case "xlsx":
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]); // ZIP container
    default: {
      const sample = bytes.subarray(0, 8192);
      return !sample.includes(0);
    }
  }
}

export type FileCheck = { ok: true; ext: string; mime: string } | { ok: false; error: string };

export function checkEvidenceFile(name: string, size: number, bytes: Uint8Array): FileCheck {
  if (size === 0) return { ok: false, error: "Il file è vuoto." };
  if (size > MAX_EVIDENCE_BYTES) return { ok: false, error: "Il file supera il limite di 20 MB." };
  const ext = extensionOf(name);
  const mime = ALLOWED_EXTENSIONS[ext];
  if (!mime) return { ok: false, error: `Estensione non consentita. Formati ammessi: ${Object.keys(ALLOWED_EXTENSIONS).join(", ")}.` };
  if (!contentMatchesExtension(ext, bytes)) return { ok: false, error: "Il contenuto del file non corrisponde all'estensione dichiarata." };
  return { ok: true, ext, mime };
}
