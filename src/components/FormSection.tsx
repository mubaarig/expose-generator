export default function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-0 border-t border-line px-0 pb-7 pt-6 first:border-t-0 first:pt-0">
      <legend className="w-full p-0">
        <span className="flex items-baseline gap-3">
          <span className="tabular-nums text-[10px] font-semibold text-accent">{number}</span>
          <span className="text-sm font-semibold text-ink">{title}</span>
        </span>
        {description && <span className="ml-8 mt-1 block text-xs leading-5 text-ink-faint">{description}</span>}
      </legend>
      <div className="ml-0 mt-5 sm:ml-8">{children}</div>
    </fieldset>
  );
}
