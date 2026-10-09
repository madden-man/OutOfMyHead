import type { Attachment } from "./types";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type FileCheck =
  | { ok: true; kind: "image" | "audio" }
  | { ok: false; message: string };

/** One image or one audio file, up to 25 MB. Messages are plain sentences for the form. */
export function checkAttachmentFile(file: { type: string; size: number }): FileCheck {
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : undefined;
  if (!kind) return { ok: false, message: "That file is not an image or audio file. Pick a photo or a recording." };
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      message: `That file is ${formatBytes(file.size)}. Files up to 25 MB fit; try a shorter clip or a smaller photo.`,
    };
  }
  return { ok: true, kind };
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
