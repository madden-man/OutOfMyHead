import type { Attachment } from "./types";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type FileCheck =
  | { ok: true; kind: "image" | "audio"; mime: string }
  | { ok: false; message: string };

// Some pickers (Android file managers, desktop browsers for less common
// formats) hand over a file with an empty type. Fall back to its extension.
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
  amr: "audio/amr",
  "3gp": "audio/3gpp",
};

/** The file's type, or one inferred from its extension when the browser gave none. */
export function attachmentMime(file: { type: string; name?: string }): string {
  if (file.type) return file.type;
  const ext = /\.([a-z0-9]+)$/i.exec(file.name ?? "")?.[1]?.toLowerCase();
  return (ext && MIME_BY_EXTENSION[ext]) || "";
}

/** One image or one audio file, up to 25 MB. Messages are plain sentences for the form. */
export function checkAttachmentFile(file: { type: string; size: number; name?: string }): FileCheck {
  const mime = attachmentMime(file);
  const kind = mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : undefined;
  if (!kind) return { ok: false, message: "That file is not an image or audio file. Pick a photo or a recording." };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      message: `That file is ${formatBytes(file.size)}. Files up to 25 MB fit; try a shorter clip or a smaller photo.`,
    };
  }
  return { ok: true, kind, mime };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** An attachment without its Blob, for export. Keeps the size so the record stays honest. */
export function attachmentMeta(a: Attachment): Omit<Attachment, "blob"> & { size?: number } {
  const { blob, ...rest } = a;
  return blob ? { ...rest, size: blob.size } : rest;
}
