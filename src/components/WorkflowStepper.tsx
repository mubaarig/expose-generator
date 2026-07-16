const STEPS = [
  ["01", "Objekt"],
  ["02", "Angaben"],
  ["03", "Generieren"],
  ["04", "Prüfen & Exportieren"],
] as const;

export default function WorkflowStepper({ active }: { active: number }) {
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-4" aria-label="Exposé-Arbeitsschritte">
      {STEPS.map(([number, label], index) => {
        const isActive = index === active;
        const isComplete = index < active;
        return (
          <li key={number} className={`bg-surface px-3 py-3 sm:px-4 ${isActive ? "shadow-[inset_0_-2px_var(--accent)]" : ""}`}>
            <span className={`tabular-nums block text-[10px] font-semibold ${isComplete || isActive ? "text-accent" : "text-ink-faint"}`}>
              {isComplete ? "✓" : number}
            </span>
            <span className={`mt-1 block text-xs font-semibold ${isActive ? "text-ink" : "text-ink-soft"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
