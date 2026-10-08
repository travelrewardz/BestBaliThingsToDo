import Link from "next/link";
import Image from "next/image";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// ------------------------------------------------------------
// Smart image: next/image for static /media assets, plain <img> for
// user uploads (may be SVG, avoids optimizer rejections).
// ------------------------------------------------------------
export function SmartImage({
  src,
  alt,
  className = "",
  fill = false,
  sizes,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={`bg-gradient-to-br from-brand-100 via-brand-50 to-sunset-100 flex items-center justify-center ${className}`}
        aria-hidden
      >
        <span className="text-4xl opacity-60">🌴</span>
      </div>
    );
  }
  const isStatic = src.startsWith("/media") && !src.endsWith(".svg");
  if (isStatic) {
    return (
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={fill ? undefined : 800}
        height={fill ? undefined : 600}
        sizes={sizes || (fill ? "(max-width: 768px) 100vw, 33vw" : undefined)}
        priority={priority}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`${fill ? "absolute inset-0 h-full w-full " : ""}object-cover ${className}`}
    />
  );
}

// ------------------------------------------------------------
// Buttons
// ------------------------------------------------------------
type BtnProps = {
  children: ReactNode;
  variant?: "primary" | "accent" | "outline" | "ghost" | "danger" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const btnStyles = (
  variant: BtnProps["variant"] = "primary",
  size: BtnProps["size"] = "md"
) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm shadow-brand-900/20",
    accent: "bg-sunset-500 text-white hover:bg-sunset-600 shadow-sm shadow-orange-900/20",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    dark: "bg-slate-900 text-white hover:bg-slate-800",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base",
  };
  return `${base} ${variants[variant]} ${sizes[size]}`;
};

export function Button({
  children,
  variant,
  size,
  className = "",
  type = "button",
  disabled,
  onClick,
  name,
  value,
}: BtnProps & {
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      name={name}
      value={value}
      className={`${btnStyles(variant, size)} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  children,
  variant,
  size,
  className = "",
  target,
}: BtnProps & { href: string; target?: string }) {
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      className={`${btnStyles(variant, size)} ${className}`}
    >
      {children}
    </Link>
  );
}

// ------------------------------------------------------------
// Display
// ------------------------------------------------------------
export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "blue" | "brand";
  className?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-sky-100 text-sky-800",
    brand: "bg-brand-100 text-brand-800",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: string;
  tone?: "brand" | "orange" | "green" | "red" | "blue";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    orange: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {icon && (
          <div className={`rounded-xl p-2.5 text-lg ${tones[tone]}`}>{icon}</div>
        )}
      </div>
    </Card>
  );
}

export function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const full = Math.round(rating);
  return (
    <span
      className={`inline-flex text-amber-400 ${size === "sm" ? "text-xs" : "text-base"}`}
      aria-label={`Rated ${rating} out of 5`}
    >
      {"★".repeat(full)}
      <span className="text-slate-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function EmptyState({
  title,
  message,
  action,
  icon = "🏝️",
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-3 text-lg font-semibold text-slate-800">{title}</h3>
      {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  basePath: string;
  params?: Record<string, string | number | undefined>;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && (
        <ButtonLink href={href(page - 1)} variant="outline" size="sm">
          ← Prev
        </ButtonLink>
      )}
      {Array.from({ length: pages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 2)
        .map((p, idx, arr) => (
          <span key={p} className="flex items-center">
            {idx > 0 && arr[idx - 1] !== p - 1 && (
              <span className="px-1 text-slate-400">…</span>
            )}
            <Link
              href={href(p)}
              aria-current={p === page ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                p === page
                  ? "bg-brand-700 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </Link>
          </span>
        ))}
      {page < pages && (
        <ButtonLink href={href(page + 1)} variant="outline" size="sm">
          Next →
        </ButtonLink>
      )}
    </nav>
  );
}

// ------------------------------------------------------------
// Forms
// ------------------------------------------------------------
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-semibold text-slate-700"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50";

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { className = "", invalid, ...rest } = props;
  return (
    <input
      {...rest}
      className={`${inputCls} ${invalid ? "border-red-400" : ""} ${className}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select {...rest} className={`${inputCls} ${className}`}>
      {children}
    </select>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`${inputCls} min-h-24 ${className}`} />;
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const tones = {
    error: "bg-red-50 border-red-200 text-red-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    info: "bg-sky-50 border-sky-200 text-sky-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${tones[tone]}`} role="alert">
      {children}
    </div>
  );
}
