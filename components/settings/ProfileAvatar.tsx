"use client";

import { useRef, useState } from "react";
import { Btn, Modal } from "@/components/app/ui";
import { Icon } from "@/components/app/icons";
import { UserAvatar } from "@/components/app/UserAvatar";
import {
  AVATAR_TONES,
  DEFAULT_AVATAR,
  fileToAvatarDataUrl,
  useAvatar,
  writeAvatar,
} from "@/lib/ui/avatar";

/**
 * 设置页「简历页眉预览」里的头像：点击头像或「更换头像」打开弹窗，
 * 支持上传本地图片（客户端裁成 256×256）或选择预设色调。
 *
 * 头像只存在浏览器 localStorage（见 lib/ui/avatar.ts），不进简历 PDF。
 */
export function ProfileAvatar({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  const avatar = useAvatar();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      writeAvatar({ kind: "image", dataUrl });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片处理失败，请换一张");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="profile-preview-head">
      <button
        type="button"
        className="avatar-edit"
        aria-label="更换头像"
        aria-haspopup="dialog"
        title="更换头像"
        onClick={() => setOpen(true)}
      >
        <UserAvatar size="lg" name={name} />
        <span className="avatar-edit-badge" aria-hidden="true">
          <Icon name="upload" size={11} />
        </span>
      </button>

      <div className="profile-preview-identity">
        <div className="profile-preview-name" title={name}>
          {name}
        </div>
        <div className="profile-preview-role" title={role}>
          {role}
        </div>
        <button
          type="button"
          className="profile-avatar-link"
          onClick={() => setOpen(true)}
        >
          更换头像
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="更换头像"
        description="头像只保存在本浏览器，用于工作台显示，不会出现在导出的简历 PDF 里。"
        size="sm"
        footer={
          <Btn variant="primary" onClick={() => setOpen(false)}>
            完成
          </Btn>
        }
      >
        <div className="avatar-dialog">
          <div className="avatar-dialog-preview">
            <UserAvatar size="lg" className="avatar-xl" name={name} />
            <div className="avatar-dialog-hint">
              建议使用正方形图片，会自动居中裁剪为 256×256。
            </div>
          </div>

          <div className="avatar-dialog-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Btn
              variant="secondary"
              icon="upload"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "处理中…" : "上传图片"}
            </Btn>
            <Btn
              variant="ghost"
              icon="refresh"
              onClick={() => {
                setError(null);
                writeAvatar(DEFAULT_AVATAR);
              }}
              disabled={busy}
            >
              恢复默认
            </Btn>
          </div>

          <div className="avatar-dialog-tones">
            <span className="avatar-dialog-label">或选一个底色</span>
            <div className="avatar-tone-row" role="radiogroup" aria-label="头像底色">
              {AVATAR_TONES.map((tone) => {
                const active =
                  avatar.kind === "initial" && avatar.tone === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={tone.label}
                    title={tone.label}
                    className={`avatar-tone-swatch avatar-tone-${tone.id}${
                      active ? " is-active" : ""
                    }`}
                    onClick={() => {
                      setError(null);
                      writeAvatar({ kind: "initial", tone: tone.id });
                    }}
                  >
                    <span>{name.trim().slice(0, 1) || "我"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <p className="avatar-dialog-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
