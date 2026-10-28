"use client";

import { useWorkspace } from "@/lib/mock/store";
import { useAvatar } from "@/lib/ui/avatar";

/**
 * 统一头像渲染：上传图片 > 预设色调首字母 > 默认首字母。
 * 顶栏、移动导航、账户菜单、设置页预览共用，保证所有出口一致。
 */
export function UserAvatar({
  size = "md",
  className = "",
  name,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** 显式传入姓名首字（设置页预览用未保存的表单值） */
  name?: string;
}) {
  const { state } = useWorkspace();
  const avatar = useAvatar();
  const initial = (name ?? state.user.name).trim().slice(0, 1) || "我";
  const sizeClass =
    size === "sm" ? "avatar-sm" : size === "lg" ? "avatar-lg" : "";

  if (avatar.kind === "image") {
    return (
      <span className={`avatar avatar-image ${sizeClass} ${className}`.trim()}>
        {/* 本地 Data URL，不经 Next/Image；alt 留空，姓名已在旁给出 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatar.dataUrl} alt="" />
      </span>
    );
  }

  return (
    <span
      className={`avatar avatar-tone-${avatar.tone} ${sizeClass} ${className}`.trim()}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
