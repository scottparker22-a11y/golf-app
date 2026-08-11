"use client";

import type { SkinsGameConfig } from "@/lib/scoring";

export default function SkinsStep({
  config,
  setConfig,
  playerCount,
}: {
  config: SkinsGameConfig;
  setConfig: (c: SkinsGameConfig) => void;
  playerCount: number;
}) {
  const enabled = config.gross || config.net;
  const pot = config.pricing.model === "flat_buyin" ? playerCount * config.pricing.buyInPerPlayer : null;

  return (
    <div className="px-5 pt-4">
      <p className="text-[13px] text-chalk-dim leading-relaxed mb-4">
        Optional — set up a skins game for this round. Leave both boxes unchecked to skip it.
      </p>

      <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
        Game selection
      </div>
      <div className="flex flex-col gap-2 mb-5">
        {(
          [
            { key: "gross" as const, label: "Gross Skins", hint: "Raw, unhandicapped scores" },
            { key: "net" as const, label: "Net Skins", hint: "Scores after handicap strokes" },
          ]
        ).map(opt => (
          <button
            key={opt.key}
            onClick={() => setConfig({ ...config, [opt.key]: !config[opt.key] })}
            className={`flex items-center gap-3 p-3 rounded-xl border text-left ${
              config[opt.key]
                ? "bg-turf/15 border-turf"
                : "bg-surface border-[color:var(--border)]"
            }`}
          >
            <span
              className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
                config[opt.key] ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
              }`}
            >
              {config[opt.key] ? "✓" : ""}
            </span>
            <span>
              <div className="text-[13.5px] font-semibold">{opt.label}</div>
              <div className="text-[11px] text-chalk-dim">{opt.hint}</div>
            </span>
          </button>
        ))}
      </div>

      {enabled && (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-chalk-dim mb-2">
            Buy-in pricing
          </div>
          <div className="flex flex-col gap-2 mb-2">
            <button
              onClick={() => setConfig({ ...config, pricing: { model: "per_skin", amountPerSkin: 5 } })}
              className={`p-3 rounded-xl border text-left ${
                config.pricing.model === "per_skin"
                  ? "bg-turf/15 border-turf"
                  : "bg-surface border-[color:var(--border)]"
              }`}
            >
              <div className="text-[13.5px] font-semibold mb-1">Per Skin Value</div>
              <div className="text-[11px] text-chalk-dim mb-2">
                A fixed dollar amount per skin won — the total pot floats with how many are won.
              </div>
              {config.pricing.model === "per_skin" && (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <span className="text-chalk-dim text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={config.pricing.amountPerSkin}
                    onChange={e =>
                      setConfig({
                        ...config,
                        pricing: { model: "per_skin", amountPerSkin: parseFloat(e.target.value) || 0 },
                      })
                    }
                    className="w-24 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-sm font-mono"
                  />
                  <span className="text-chalk-dim text-[11px]">per skin</span>
                </div>
              )}
            </button>

            <button
              onClick={() => setConfig({ ...config, pricing: { model: "flat_buyin", buyInPerPlayer: 20 } })}
              className={`p-3 rounded-xl border text-left ${
                config.pricing.model === "flat_buyin"
                  ? "bg-turf/15 border-turf"
                  : "bg-surface border-[color:var(--border)]"
              }`}
            >
              <div className="text-[13.5px] font-semibold mb-1">Flat Per-Player Buy-In</div>
              <div className="text-[11px] text-chalk-dim mb-2">
                A fixed entry fee per player — the pot is split evenly across every skin won.
              </div>
              {config.pricing.model === "flat_buyin" && (
                <div onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-chalk-dim text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={config.pricing.buyInPerPlayer}
                      onChange={e =>
                        setConfig({
                          ...config,
                          pricing: { model: "flat_buyin", buyInPerPlayer: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="w-24 bg-surface-raised border border-[color:var(--border-strong)] rounded-lg px-2.5 py-2 text-sm font-mono"
                    />
                    <span className="text-chalk-dim text-[11px]">entry fee per player</span>
                  </div>
                  {pot !== null && (
                    <div className="text-[11px] text-chalk-dim font-mono">
                      Total pot: {playerCount} × ${config.pricing.buyInPerPlayer.toFixed(2)} = $
                      {pot.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </button>
          </div>

          <button
            onClick={() => setConfig({ ...config, rollover: !config.rollover })}
            className="w-full flex items-center gap-3 p-3 rounded-xl border bg-surface border-[color:var(--border)] text-left mt-3"
          >
            <span
              className={`w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
                config.rollover ? "bg-turf border-turf text-fairway-950" : "border-chalk-dim"
              }`}
            >
              {config.rollover ? "✓" : ""}
            </span>
            <span>
              <div className="text-[13.5px] font-semibold">Roll over tied holes</div>
              <div className="text-[11px] text-chalk-dim">
                If unchecked, a tied hole's skin is lost instead of carrying to the next hole.
              </div>
            </span>
          </button>
        </>
      )}
    </div>
  );
}
