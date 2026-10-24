"use client";

import { useCallback, useEffect, useState } from "react";

import { readJsonPref, writeJsonPref } from "@/lib/ui/prefs";

const STORAGE_KEY = "editor.collapsed-sections.v1";
const SYNC_EVENT = "editor:sections-sync";

type SyncDetail = { collapsed: string[] };

function readCollapsed(): string[] {
  const value = readJsonPref<unknown>(STORAGE_KEY, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function writeCollapsed(ids: string[]): void {
  writeJsonPref(STORAGE_KEY, Array.from(new Set(ids)));
  window.dispatchEvent(
    new CustomEvent<SyncDetail>(SYNC_EVENT, {
      detail: { collapsed: Array.from(new Set(ids)) },
    }),
  );
}

/** 单个内容卡片的折叠状态：跨刷新保留，并同步「全部收起/展开」。 */
export function useSectionCollapse(id: string, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    setCollapsed(readCollapsed().includes(id));
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SyncDetail>).detail;
      if (!detail) return;
      setCollapsed(detail.collapsed.includes(id));
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [id]);

  const toggle = useCallback(() => {
    const current = new Set(readCollapsed());
    const next = !current.has(id);
    if (next) current.add(id);
    else current.delete(id);
    writeCollapsed(Array.from(current));
  }, [id]);

  return { collapsed, toggle };
}

/** 「全部收起 / 全部展开」的状态与操作（编辑器左栏使用）。 */
export function useAllSectionsCollapsed(ids: string[]) {
  const [allCollapsed, setAllCollapsed] = useState(false);

  useEffect(() => {
    const sync = (collapsed: string[]) => {
      setAllCollapsed(ids.every((id) => collapsed.includes(id)));
    };
    sync(readCollapsed());
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SyncDetail>).detail;
      if (detail) sync(detail.collapsed);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [ids]);

  const toggleAll = useCallback(() => {
    const current = readCollapsed();
    const shouldCollapse = !ids.every((id) => current.includes(id));
    writeCollapsed(shouldCollapse ? ids : current.filter((id) => !ids.includes(id)));
  }, [ids]);

  return { allCollapsed, toggleAll };
}
