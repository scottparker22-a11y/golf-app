export default function GameChips({
  skinsPot,
}: {
  skinsPot: number;
}) {
  return (
    <div className="flex gap-2.5 px-5 pt-4 overflow-x-auto">
      <div className="flex-shrink-0 bg-surface border border-[color:var(--border)] rounded-xl px-3.5 py-3 min-w-[128px]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-1.5">Skins pot</div>
        <div className="font-mono text-base font-semibold text-flag">${skinsPot}</div>
      </div>
    </div>
  );
}
