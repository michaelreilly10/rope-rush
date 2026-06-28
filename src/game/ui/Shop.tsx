import { useState } from "react";
import type { Game } from "../engine";
import { CHARACTERS, ROPES, TRAILS } from "../cosmetics";

type Tab = "char" | "rope" | "trail";

export function Shop({ game, onBack }: { game: Game; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("char");
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  const save = game.save;
  const items =
    tab === "char" ? CHARACTERS.map((c) => ({ id: c.id, name: c.name, price: c.price, color: c.sash }))
    : tab === "rope" ? ROPES.map((r) => ({ id: r.id, name: r.name, price: r.price, color: r.color }))
    : TRAILS.map((t) => ({ id: t.id, name: t.name, price: t.price, color: t.color }));
  const slot = tab === "char" ? "chars" : tab === "rope" ? "ropes" : "trails";
  const equippedId = save.equipped[tab];

  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-zinc-900 to-black text-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <button onClick={onBack} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">← Back</button>
        <div className="font-display text-2xl">Shop</div>
        <div className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-300">● {save.coins}</div>
      </div>

      <div className="mt-4 flex justify-center gap-2 px-4">
        {(["char", "rope", "trail"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-3 py-2 text-sm capitalize ${
              tab === t ? "bg-rose-500 text-white" : "bg-white/10 text-white/70"
            }`}
          >
            {t === "char" ? "Ninja" : t === "rope" ? "Ropes" : "Trails"}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const owned = save.unlocked[slot].includes(item.id);
            const equipped = equippedId === item.id;
            return (
              <div
                key={item.id}
                className={`flex flex-col items-center rounded-2xl border p-3 ${
                  equipped ? "border-rose-400 bg-white/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div
                  className="mb-2 grid h-16 w-16 place-items-center rounded-xl"
                  style={{ background: `radial-gradient(circle, ${item.color}40, transparent 70%)` }}
                >
                  <div
                    className="h-10 w-10 rounded-lg"
                    style={{ background: item.color }}
                  />
                </div>
                <div className="text-center text-sm">{item.name}</div>
                <div className="mt-2">
                  {owned ? (
                    equipped ? (
                      <span className="rounded-full bg-rose-500 px-3 py-1 text-xs">Equipped</span>
                    ) : (
                      <button
                        onClick={() => { game.equip(tab, item.id); rerender(); }}
                        className="rounded-full bg-white/15 px-3 py-1 text-xs"
                      >
                        Equip
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => { if (game.buy(tab, item.id, item.price)) rerender(); }}
                      disabled={save.coins < item.price}
                      className="rounded-full bg-amber-400 px-3 py-1 text-xs text-black disabled:opacity-40"
                    >
                      ● {item.price}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
