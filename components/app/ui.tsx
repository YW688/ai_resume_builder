"use client";

import {
  Fragment,
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";

/* --------------------------------- 基础 ---------------------------------- */

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 极简加载指示器：`.spin` + ui-spin 关键帧。 */
export type SpinnerProps = {
  size?: number;
  className?: string;
  label?: string;
};

export function Spinner({ size = 16, className, label = "加载中" }: SpinnerProps) {
  return (
    <span
      className={cx("spin", className)}
      role="status"
      aria-label={label}
      style={{ display: "inline-flex", flex: "none", animation: "ui-spin 0.8s linear infinite" }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.4" />
        <path
          d="M12 3a9 9 0 0 1 9 9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/* --------------------------------- 按钮 ---------------------------------- */

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export type BtnSize = "sm" | "md" | "lg";

export type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  block?: boolean;
};

export function Btn({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: BtnProps) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button
      type={type}
      className={cx(
        "btn",
        `btn-${variant}`,
        size === "sm" && "btn-sm",
        size === "lg" && "btn-lg",
        block && "btn-block",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={iconSize - 2} /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}

export type IconBtnVariant = "plain" | "bordered" | "active";

export type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 必填：图标按钮必须有可访问名称。 */
  label: string;
  icon: IconName;
  size?: number;
  variant?: IconBtnVariant;
};

export function IconBtn({
  label,
  icon,
  size = 16,
  variant = "plain",
  className,
  type = "button",
  ...rest
}: IconBtnProps) {
  return (
    <button
      type={type}
      className={cx(
        "btn-icon",
        variant === "bordered" && "is-bordered",
        variant === "active" && "is-active",
        className,
      )}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* --------------------------------- 标签 ---------------------------------- */

export type PillTone = "neutral" | "accent" | "positive" | "warning" | "negative" | "outline";

export type PillProps = {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
};

export function Pill({ tone = "neutral", dot = false, className, children }: PillProps) {
  return (
    <span className={cx("pill", `pill-${tone}`, className)}>
      {dot ? <span className="pill-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* --------------------------------- 进度 ---------------------------------- */

export type ProgressTone = "accent" | "positive" | "neutral" | "warning";

export type ProgressProps = {
  value: number;
  tone?: ProgressTone;
  showValue?: boolean;
  label?: string;
  className?: string;
};

export function Progress({ value, tone = "accent", showValue = false, label, className }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cx("progress", className)}>
      {label !== undefined || showValue ? (
        <div className="progress-meta">
          <span>{label}</span>
          {showValue ? <span className="progress-value">{pct}%</span> : null}
        </div>
      ) : null}
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "进度"}
      >
        <div
          className={cx("progress-fill", tone !== "accent" && `is-${tone}`)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------- 匹配度环 -------------------------------- */

export type RingProps = {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
};

export function Ring({ value, size = 48, stroke = 4, label, className }: RingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const radius = Math.max(1, (size - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  const center = size / 2;
  return (
    <div
      className={cx("score-ring", className)}
      role="img"
      aria-label={`${label ?? "匹配度"} ${pct} 分`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true" focusable="false">
        <circle cx={center} cy={center} r={radius} stroke="var(--ui-neutral-bg)" strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="var(--ui-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <span className="score-ring-text">
        <span className="score-ring-value">{pct}</span>
        {label ? <span className="score-ring-label">{label}</span> : null}
      </span>
    </div>
  );
}

/* --------------------------------- 弹窗 ---------------------------------- */

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  );
}

export type ModalSize = "sm" | "md" | "lg";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  className?: string;
  children?: ReactNode;
};

/**
 * 通用弹窗：createPortal 到 body、Esc / 遮罩关闭、焦点移入并在关闭时归还、
 * Tab 焦点环形；移动端（≤640px）由 app-ui.css 自动变成底部抽屉。
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = "md",
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const node = dialogRef.current;
    const initial = getFocusable(node);
    if (initial.length > 0) initial[0].focus();
    else node?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const current = dialogRef.current;
      if (!current) return;
      const items = getFocusable(current);
      if (items.length === 0) {
        event.preventDefault();
        current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      const restore = restoreRef.current;
      restoreRef.current = null;
      if (restore && restore.isConnected) restore.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={cx("dialog", size !== "md" && `dialog-${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "对话框"}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <div>
            {title ? (
              <div className="dialog-title" id={titleId}>
                {title}
              </div>
            ) : null}
            {description ? <div className="dialog-desc">{description}</div> : null}
          </div>
          <IconBtn className="dialog-close" label="关闭" icon="close" onClick={onClose} />
        </div>
        {children !== undefined && children !== null ? (
          <div className="dialog-body">{children}</div>
        ) : null}
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "default",
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Btn>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* --------------------------------- 菜单 ---------------------------------- */

export type MenuItem = {
  label: string;
  icon?: IconName;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  /** 在该项前插入分隔线（等价于 `.menu-sep`）。 */
  divider?: boolean;
};

export type MenuProps = {
  trigger: ReactElement;
  items: MenuItem[];
  /** 菜单顶部自定义头（账户菜单用于显示头像 + 姓名 + 邮箱）。 */
  header?: React.ReactNode;
  align?: "left" | "right";
  /** 从触发器上方展开（用于贴底的账户菜单，避免被视口/容器裁切）。 */
  placement?: "bottom" | "top";
  className?: string;
};

type MenuTriggerProps = {
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
  onClick?: (event: ReactMouseEvent) => void;
};

export function Menu({
  trigger,
  items,
  header,
  align = "left",
  placement = "bottom",
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = popRef.current?.querySelector<HTMLButtonElement>(".menu-item:not(:disabled)");
    first?.focus();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!wrapRef.current?.contains(target)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const pop = popRef.current;
      if (!pop) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = Array.from(pop.querySelectorAll<HTMLButtonElement>(".menu-item:not(:disabled)"));
      if (buttons.length === 0) return;
      event.preventDefault();
      const activeIndex = buttons.findIndex((button) => button === document.activeElement);
      const nextIndex =
        event.key === "ArrowDown"
          ? (activeIndex + 1 + buttons.length) % buttons.length
          : (activeIndex - 1 + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      const restore = restoreRef.current;
      restoreRef.current = null;
      if (restore && restore.isConnected) restore.focus();
    };
  }, [open]);

  const triggerWithProps = trigger as ReactElement<MenuTriggerProps>;
  const originalOnClick = triggerWithProps.props.onClick;
  const triggerNode = cloneElement(triggerWithProps, {
    "aria-haspopup": "menu",
    "aria-expanded": open,
    onClick: (event: ReactMouseEvent) => {
      originalOnClick?.(event);
      if (!event.defaultPrevented) setOpen((previous) => !previous);
    },
  });

  return (
    <span ref={wrapRef} className={cx("menu-wrap", className)}>
      {triggerNode}
      {open ? (
        <div
          ref={popRef}
          className={cx(
            "menu-pop",
            align === "right" && "align-right",
            placement === "top" && "align-top",
          )}
          role="menu"
        >
          {header ? <div className="menu-head">{header}</div> : null}
          {items.map((item, index) => (
            <Fragment key={`${item.label}-${index}`}>
              {item.divider ? <div className="menu-sep" role="separator" /> : null}
              <button
                type="button"
                role="menuitem"
                className={cx("menu-item", item.danger && "is-danger")}
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.icon ? <Icon name={item.icon} size={15} className="menu-icon" /> : null}
                <span>{item.label}</span>
                {item.hint ? <span className="menu-hint">{item.hint}</span> : null}
              </button>
            </Fragment>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/* --------------------------------- 空状态 -------------------------------- */

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cx("empty", className)}>
      {icon ? (
        <span className="empty-icon">
          <Icon name={icon} size={22} />
        </span>
      ) : null}
      <div className="empty-title">{title}</div>
      {description ? <div className="empty-desc">{description}</div> : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

/* --------------------------------- 表单 ---------------------------------- */

export type FieldProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, htmlFor, required, className, children }: FieldProps) {
  return (
    <div className={cx("field", className)}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="req" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <div className="field-error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="field-hint">{hint}</div>
      ) : null}
    </div>
  );
}

export type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  id?: string;
  disabled?: boolean;
  /** 无可见 label 时的可访问名称。 */
  ariaLabel?: string;
};

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
  ariaLabel,
}: ToggleProps) {
  const autoId = useId();
  const labelId = `${autoId}-label`;
  const button = (
    <button
      type="button"
      role="switch"
      id={id}
      className="toggle"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-label={label ? undefined : (ariaLabel ?? "切换")}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
  if (!label && !description) return button;
  return (
    <div className="toggle-row">
      <div>
        {label ? (
          <div className="toggle-label" id={labelId}>
            {label}
          </div>
        ) : null}
        {description ? <div className="toggle-desc">{description}</div> : null}
      </div>
      {button}
    </div>
  );
}

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export type SegmentedProps<T extends string> = {
  /** 类型只从 value 推断，options / onChange 用 NoInfer 校验，避免被字面量推断成 string。 */
  options: ReadonlyArray<SegmentedOption<NoInfer<T>>>;
  value: T;
  /** 方法签名（而非函数属性）以保持参数双变，页面可直接传入窄类型 setter。 */
  onChange(value: NoInfer<T>): void;
  ariaLabel: string;
  className?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={cx("segmented", className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx("seg-item", option.value === value && "is-active")}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- 关键词 -------------------------------- */

export type KeywordChipState = "hit" | "missing" | "neutral";

export type KeywordChipProps = {
  label: string;
  state?: KeywordChipState;
  onClick?: () => void;
  className?: string;
};

export function KeywordChip({ label, state = "neutral", onClick, className }: KeywordChipProps) {
  const classes = cx(
    state === "hit" && "kw kw-hit",
    state === "missing" && "kw kw-missing",
    state === "neutral" && "chip",
    className,
  );
  const content = (
    <>
      {state === "hit" ? <Icon name="check" size={12} /> : null}
      {state === "missing" ? <Icon name="plus" size={12} /> : null}
      <span>{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <span className={classes}>{content}</span>;
}
