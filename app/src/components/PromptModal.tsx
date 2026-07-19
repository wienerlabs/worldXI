import { useState } from "react";

export interface PromptField {
  /** Key the value is returned under. */
  name: string;
  label: string;
  placeholder: string;
  maxLength?: number;
  /** Force input to uppercase (invite codes, country codes). */
  uppercase?: boolean;
  /** Optional fields may be left blank; submit stays enabled. */
  optional?: boolean;
}

interface PromptModalProps {
  /** Small kicker above the title, e.g. "Friend league" or "Manager profile". */
  eyebrow: string;
  title: string;
  fields: PromptField[];
  hint?: string;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
}

/**
 * In-app modal styled to match the app, used instead of the browser's native prompt.
 * Supports one or more fields, so the same component serves the league flows (single
 * input) and the first-time manager profile (nickname plus optional country).
 */
export function PromptModal({ eyebrow, title, fields, hint, submitLabel, onSubmit, onClose }: PromptModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const valueOf = (name: string): string => values[name] ?? "";
  const canSubmit = fields.every((f) => f.optional || valueOf(f.name).trim().length > 0);
  const submit = (): void => {
    if (canSubmit) onSubmit(values);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.66)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 200, padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel panel-notch rise"
        style={{ width: "min(440px, 96vw)", padding: "26px 26px 22px", borderTop: "2px solid var(--volt)" }}
      >
        <div className="between" style={{ alignItems: "center", marginBottom: 6 }}>
          <div className="eyebrow" style={{ color: "var(--volt)" }}>{eyebrow}</div>
          <button onClick={onClose} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 13 }}>x</button>
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.01em" }}>{title}</h3>

        {fields.map((f, i) => (
          <div key={f.name}>
            <label className="mono" style={{ display: "block", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)", margin: i === 0 ? "20px 0 8px" : "16px 0 8px" }}>
              {f.label}
            </label>
            <input
              autoFocus={i === 0}
              value={valueOf(f.name)}
              maxLength={f.maxLength}
              placeholder={f.placeholder}
              onChange={(e) => {
                const next = f.uppercase ? e.target.value.toUpperCase() : e.target.value;
                setValues((v) => ({ ...v, [f.name]: next }));
              }}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{
                width: "100%", padding: "12px 14px", fontSize: 16, fontWeight: 700,
                letterSpacing: f.uppercase ? "0.16em" : "normal",
                background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)",
                color: "var(--chalk)", outline: "none",
              }}
            />
          </div>
        ))}

        {hint && <p className="mono" style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 10, letterSpacing: "0.02em" }}>{hint}</p>}

        <div className="row" style={{ gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button onClick={onClose} className="btn btn-outline">Cancel</button>
          <button onClick={submit} disabled={!canSubmit} className="btn btn-primary">{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
