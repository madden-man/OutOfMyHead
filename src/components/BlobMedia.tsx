import { useEffect, useRef } from "react";

/**
 * Point a media element at a Blob through an object URL. The URL is made when
 * the element mounts or the Blob changes, and revoked on the way out.
 */
function useBlobSrc<T extends HTMLImageElement | HTMLAudioElement>(blob: Blob) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const url = URL.createObjectURL(blob);
    el.src = url;
    return () => {
      el.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return ref;
}

export function BlobImage({ blob, alt, className }: { blob: Blob; alt: string; className?: string }) {
  const ref = useBlobSrc<HTMLImageElement>(blob);
  return <img ref={ref} className={className} alt={alt} />;
}

export function BlobAudio({ blob, label, className }: { blob: Blob; label: string; className?: string }) {
  const ref = useBlobSrc<HTMLAudioElement>(blob);
  return <audio ref={ref} className={className} controls preload="metadata" aria-label={label} />;
}
