import Link from "next/link";

export default function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3" aria-label="Exposé Werkstatt Startseite">
      <span className="grid size-9 place-items-center bg-ink text-[11px] font-semibold tracking-[0.12em] text-surface">
        EW
      </span>
      <span className="leading-none">
        <span className="block text-sm font-semibold tracking-[-0.02em]">Exposé Werkstatt</span>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-ink-faint">Immobilientexte</span>
      </span>
    </Link>
  );
}
