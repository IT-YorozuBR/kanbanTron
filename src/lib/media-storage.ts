import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import sharp, { type Metadata } from "sharp";
import { fileTypeFromBuffer } from "file-type";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "./validation";

// Deliberately outside of /public: Next.js's production server only serves
// files that existed in public/ at build time, not ones written at runtime.
// Uploaded media is instead served through the /media/[filename] route handler.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export class MediaValidationError extends Error {}

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export type StoredMedia = {
  filename: string;
  mimeType: string;
  kind: "image" | "video";
  size: number;
  width: number | null;
  height: number | null;
};

const HARD_SIZE_CEILING = Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES);

export async function storeMediaAttachment(file: File): Promise<StoredMedia> {
  if (file.size <= 0 || file.size > HARD_SIZE_CEILING) {
    throw new MediaValidationError("Arquivo invalido ou excede o tamanho maximo permitido.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Trust content sniffing over the browser-supplied name/mimetype for the
  // video branch: there is no equivalent to sharp's decode-and-re-encode
  // step for video, so magic-byte detection is the strongest check available.
  const detected = await fileTypeFromBuffer(buffer);
  if (detected && (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(detected.mime)) {
    if (buffer.length > MAX_VIDEO_BYTES) {
      throw new MediaValidationError("Video excede o tamanho maximo de 80MB.");
    }
    return storeVideo(buffer, detected.mime);
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new MediaValidationError("Arquivo excede o tamanho maximo de 5MB.");
  }
  return storeImage(buffer);
}

async function storeImage(buffer: Buffer): Promise<StoredMedia> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new MediaValidationError("O arquivo enviado nao e uma imagem ou video valido.");
  }

  const detectedMime = metadata.format ? `image/${metadata.format}` : "";
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(detectedMime as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    throw new MediaValidationError("Formato de imagem nao suportado.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.webp`;
  const destination = path.join(UPLOAD_DIR, filename);

  // Re-encoding (rather than trusting the original bytes) strips EXIF/XMP
  // metadata and neutralizes polyglot payloads hidden inside otherwise-valid
  // image files.
  const pipeline = sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 });

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  await writeFile(destination, output.data);

  return {
    filename,
    mimeType: "image/webp",
    kind: "image",
    size: output.data.length,
    width: output.info.width ?? null,
    height: output.info.height ?? null,
  };
}

async function storeVideo(buffer: Buffer, mime: string): Promise<StoredMedia> {
  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = VIDEO_EXTENSIONS[mime] ?? "mp4";
  const filename = `${randomUUID()}.${ext}`;
  const destination = path.join(UPLOAD_DIR, filename);

  // Videos are stored as-is (no ffmpeg dependency for transcoding); the
  // magic-byte check above is what stands in for sharp's re-encode step.
  await writeFile(destination, buffer);

  return {
    filename,
    mimeType: mime,
    kind: "video",
    size: buffer.length,
    width: null,
    height: null,
  };
}

export async function deleteMediaFile(filename: string): Promise<void> {
  // filename is always a server-generated uuid, never user input, so this is
  // safe from path traversal by construction.
  const safeName = path.basename(filename);
  const target = path.join(UPLOAD_DIR, safeName);
  await unlink(target).catch(() => undefined);
}
