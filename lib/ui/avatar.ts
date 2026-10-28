"use client";

import { useSyncExternalStore } from "react";

/**
 * 用户头像（本地偏好）。
 *
 * 为什么存 localStorage 而不是数据库：头像属于展示偏好，当前 User 表没有
 * avatar 字段，改 schema 需要迁移；先用本地存储实现「自由更换」，同一浏览器
 * 内所有页面（顶栏、侧栏、设置预览）共用一份状态。跨设备同步需要等后端字段。
 */

export type AvatarTone =
  | "default"
  | "accent"
  | "pink"
  | "sun"
  | "mint"
  | "graphite";

export type AvatarState =
  | { kind: "initial"; tone: AvatarTone }
  | { kind: "image"; dataUrl: string };

export const AVATAR_STORAGE_KEY = "app.avatar.v1";

const AVATAR_EVENT = "app:avatarchange";

export const DEFAULT_AVATAR: AvatarState = { kind: "initial", tone: "default" };

export const AVATAR_TONES: { id: AvatarTone; label: string }[] = [
  { id: "default", label: "默认" },
  { id: "accent", label: "雾紫" },
  { id: "pink", label: "绯粉" },
  { id: "sun", label: "暖黄" },
  { id: "mint", label: "薄荷" },
  { id: "graphite", label: "石墨" },
];

const TONE_IDS = AVATAR_TONES.map((item) => item.id);

function isTone(value: unknown): value is AvatarTone {
  return typeof value === "string" && TONE_IDS.includes(value as AvatarTone);
}

function isAvatarState(value: unknown): value is AvatarState {
  if (!value || typeof value !== "object") return false;
  const record = value as { kind?: unknown; tone?: unknown; dataUrl?: unknown };
  if (record.kind === "initial") return isTone(record.tone);
  if (record.kind === "image") {
    return typeof record.dataUrl === "string" && record.dataUrl.startsWith("data:image/");
  }
  return false;
}

function parseAvatar(): AvatarState {
  if (typeof window === "undefined") return DEFAULT_AVATAR;
  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return DEFAULT_AVATAR;
    const parsed: unknown = JSON.parse(raw);
    return isAvatarState(parsed) ? parsed : DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
}

/**
 * useSyncExternalStore 的快照必须是稳定引用，否则会判定为无限更新。
 * 这里缓存一份，写入 / 跨标签变化时失效。
 */
let snapshot: AvatarState | null = null;

export function readAvatar(): AvatarState {
  if (snapshot === null) snapshot = parseAvatar();
  return snapshot;
}

export function writeAvatar(next: AvatarState) {
  snapshot = next;
  try {
    window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 存储满 / 隐私模式：忽略，当前页面仍会通过事件刷新 */
  }
  window.dispatchEvent(new Event(AVATAR_EVENT));
}

export function subscribeAvatar(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key !== AVATAR_STORAGE_KEY) return;
    snapshot = null;
    onChange();
  }
  window.addEventListener(AVATAR_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AVATAR_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAvatar(): AvatarState {
  return useSyncExternalStore(subscribeAvatar, readAvatar, () => DEFAULT_AVATAR);
}

/**
 * 把用户选择的图片裁成 256×256 JPEG Data URL（居中 cover 裁切）。
 * 输出体积通常 15–40KB，塞得进 localStorage。
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件（JPG / PNG / WebP）");
  if (file.size > 8 * 1024 * 1024) throw new Error("图片不能超过 8MB");

  const bitmap = await loadBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器无法处理图片");

  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.86);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* 回退到 <img> 解码 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
