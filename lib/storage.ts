import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import crypto from "node:crypto";

// Neon Storage 是 S3 兼容对象存储。endpoint / region 等以 Neon 控制台提供为准。
const client = new S3Client({
  region: process.env.NEON_STORAGE_REGION ?? "auto",
  endpoint: process.env.NEON_STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY!,
    secretAccessKey: process.env.NEON_STORAGE_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.NEON_STORAGE_BUCKET!;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadPhoto(userId: string, file: File): Promise<string> {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = `${userId}/${crypto.randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: file.type,
    }),
  );

  return key;
}

export async function deletePhoto(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
