import { useEffect, useRef } from "react";
import type { Raster } from "../core/render";
import { tr } from "../i18n";
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = -32768,
  max = 32767,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n))
            onChange(
              Math.max(min, Math.min(max, step >= 1 ? Math.round(n) : n)),
            );
        }}
      />
    </Field>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
}) {
  return (
    <Field label={label}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Preview({
  image,
  scale = 1,
  className = "",
  label = "Preview",
}: {
  image: Raster;
  scale?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = image.width;
    c.height = image.height;
    c.getContext("2d")!.putImageData(
      new ImageData(
        new Uint8ClampedArray(image.data),
        image.width,
        image.height,
      ),
      0,
      0,
    );
  }, [image]);
  return (
    <canvas
      aria-label={label}
      className={`pixel ${className}`}
      ref={ref}
      style={{ width: image.width * scale, height: image.height * scale }}
    />
  );
}
export function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <div className="empty-cross">＋</div>
      <p>{text}</p>
    </div>
  );
}
export const DeleteButton = ({ onClick }: { onClick: () => void }) => (
  <button className="danger" onClick={onClick}>
    {tr("Supprimer", "Delete")}
  </button>
);
