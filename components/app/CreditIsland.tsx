"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/app/icons";
import { Progress } from "@/components/app/ui";
import { CreditIcon } from "@/components/credits/CreditIcon";
import { useWorkspace } from "@/lib/mock/store";

/**
 * 顶栏点数胶囊（灵动岛逻辑）：
 * 收起态只显示余额；展开成一个小面板显示今日免费额度与购买入口。
 * 侧边栏不再放点数卡，避免与顶栏重复。
 */
export function CreditIsland() {
  const { state } = useWorkspace();
  const router = useRouter();
  const credits = state.credits;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const dailyPct =
    credits.dailyFree > 0 ? (credits.dailyUsed / credits.dailyFree) * 100 : 0;
  const low = credits.plan === "member" && credits.balance === 0;
  const tone = low ? "low" : credits.balance > 0 ? "default" : "free";
  const tier = low ? "余额不足" : credits.plan === "member" ? "点数会员" : "免费额度";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) return;
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="credit-island" ref={wrapRef}>
      <button
        type="button"
        className={`credit-island-trigger${open ? " is-open" : ""}${low ? " is-low" : ""}`}
        aria-expanded={open}
        aria-controls="credit-island-panel"
        aria-label={`点数余额 ${credits.balance} 点，今日免费还剩 ${credits.dailyRemaining} 点`}
        onClick={() => setOpen((value) => !value)}
      >
        <CreditIcon size={15} tone={tone} decorative />
        <span className="credit-island-balance num">{credits.balance}</span>
        <span className="credit-island-unit">点</span>
        <span className="credit-island-daily">
          今日 {credits.dailyRemaining}/{credits.dailyFree}
        </span>
        <Icon name="chevronDown" size={12} className="credit-island-caret" />
      </button>

      {open ? (
        <div
          className="credit-island-panel"
          id="credit-island-panel"
          role="dialog"
          aria-label="点数"
        >
          <div className="credit-island-head">
            <span className="credit-island-title">点数余额</span>
            <span className="credit-island-tier">{tier}</span>
          </div>

          <div className="credit-island-amount">
            <strong className="num">{credits.balance}</strong>
            <span>点</span>
          </div>

          <div className="credit-island-meter">
            <div className="credit-island-meter-head">
              <span>今日免费</span>
              <span className="num">
                {credits.dailyRemaining} / {credits.dailyFree} 点
              </span>
            </div>
            <Progress value={dailyPct} tone="warning" />
          </div>

          <div className="credit-island-actions">
            <button
              type="button"
              className="btn credit-island-buy"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard/settings");
              }}
            >
              购买点数
            </button>
            <button
              type="button"
              className="credit-island-link"
              onClick={() => {
                setOpen(false);
                router.push("/dashboard/settings");
              }}
            >
              点数明细 <Icon name="chevronRight" size={12} />
            </button>
          </div>

          <p className="credit-island-note">PDF 导出免费 · 点数只用于 AI 改写</p>
        </div>
      ) : null}
    </div>
  );
}
