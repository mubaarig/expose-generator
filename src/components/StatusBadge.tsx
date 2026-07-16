export default function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "accent";
}) {
  const tones = {
    neutral: "border-line bg-surface-muted text-ink-soft",
    success: "border-success/20 bg-success-soft text-success",
    warning: "border-warning/20 bg-warning-soft text-warning",
    accent: "border-accent/20 bg-accent-soft text-accent-dark",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
