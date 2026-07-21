"use client";

import Image from "next/image";
import { VideoPlayer } from "@/components/board/video-player";
import type { AttachmentData } from "@/lib/types";

export function MediaLightbox({ attachment, onClose }: { attachment: AttachmentData; onClose: () => void }) {
  const isVideo = attachment.mimeType.startsWith("video/");
  const src = `/media/${attachment.filename}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div className="flex w-full max-w-3xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-end gap-2">
          <a
            href={src}
            download={attachment.originalName}
            className="aero-button aero-button-lime text-xs"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1.5V9.5M7 9.5L3.5 6M7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 11.5V12.5C2 12.7761 2.22386 13 2.5 13H11.5C11.7761 13 12 12.7761 12 12.5V11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Baixar
          </a>
          <button type="button" onClick={onClose} aria-label="Fechar" className="aero-button aero-button-ghost text-xs">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Fechar
          </button>
        </div>

        {isVideo ? (
          <VideoPlayer src={src} />
        ) : (
          <div className="flex justify-center">
            <Image
              src={src}
              alt={attachment.originalName}
              width={attachment.width ?? 1600}
              height={attachment.height ?? 1200}
              className="max-h-[70vh] w-auto rounded-xl object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
}
