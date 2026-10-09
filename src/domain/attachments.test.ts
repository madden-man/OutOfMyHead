import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, attachmentMeta, checkAttachmentFile, formatBytes } from "./attachments";

describe("checkAttachmentFile", () => {
  it("accepts images and audio up to 25 MB", () => {
    expect(checkAttachmentFile({ type: "image/jpeg", size: 10 })).toEqual({ ok: true, kind: "image", mime: "image/jpeg" });
    expect(checkAttachmentFile({ type: "audio/mp4", size: MAX_ATTACHMENT_BYTES })).toEqual({
      ok: true,
      kind: "audio",
      mime: "audio/mp4",
    });
  });

  it("falls back to the extension when the picker gives no type", () => {
    expect(checkAttachmentFile({ type: "", size: 10, name: "Voice 012.OPUS" })).toEqual({
      ok: true,
      kind: "audio",
      mime: "audio/ogg",
    });
    expect(checkAttachmentFile({ type: "", size: 10, name: "IMG_0042.heic" })).toEqual({
      ok: true,
      kind: "image",
      mime: "image/heic",
    });
    expect(checkAttachmentFile({ type: "", size: 10, name: "notes.txt" }).ok).toBe(false);
    expect(checkAttachmentFile({ type: "", size: 10 }).ok).toBe(false);
  });

  it("rejects other types and anything over 25 MB with a sentence", () => {
    const pdf = checkAttachmentFile({ type: "application/pdf", size: 10 });
    expect(pdf.ok).toBe(false);
    const big = checkAttachmentFile({ type: "audio/wav", size: MAX_ATTACHMENT_BYTES + 1 });
    expect(big).toEqual({
      ok: false,
      message: "That file is 25.0 MB. Files up to 25 MB fit; try a shorter clip or a smaller photo.",
    });
  });

  it("formats sizes", () => {
    expect(formatBytes(70)).toBe("70 bytes");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });

  it("drops the blob from metadata but keeps its size", () => {
    const blob = new Blob(["abc"], { type: "audio/mp4" });
    expect(attachmentMeta({ kind: "audio", blob, mime: "audio/mp4", name: "a.m4a" })).toEqual({
      kind: "audio",
      mime: "audio/mp4",
      name: "a.m4a",
      size: 3,
    });
    expect(attachmentMeta({ kind: "text", text: "hi" })).toEqual({ kind: "text", text: "hi" });
  });
});
