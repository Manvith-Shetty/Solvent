"use client";

import { Attestation, formatStroops, formatTimestamp } from "../lib/stellar";

export default function AttestationCard({ att }: { att: Attestation | null }) {
  if (!att) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-500">No attestations recorded yet.</p>
      </div>
    );
  }

  const reserve = parseFloat(att.reserve);
  const liabilities = parseFloat(att.total_liabilities);
  const ratio = liabilities > 0 ? ((reserve / liabilities) * 100).toFixed(1) : "∞";
  const coveragePct = Math.min((reserve / Math.max(liabilities, 1)) * 100, 100);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Status Badge */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Attestation #{att.seq}</p>
          <p className="text-xs text-zinc-400">
            Ledger {att.ledger} · {formatTimestamp(att.timestamp)}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${
            att.solvent
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-400/20"
              : "bg-red-50 text-red-700 ring-1 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-400/20"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${att.solvent ? "bg-emerald-500" : "bg-red-500"}`}
          />
          {att.solvent ? "SOLVENT" : "INSOLVENT"}
        </span>
      </div>

      {/* Comparison Bars */}
      <div className="mb-6 space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Reserve</span>
            <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
              {formatStroops(att.reserve)} XLM
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: "100%" }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Total Liabilities</span>
            <span className="font-mono text-sm text-amber-600 dark:text-amber-400">
              {formatStroops(att.total_liabilities)} XLM
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${
                att.solvent ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(coveragePct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Coverage Ratio</p>
          <p className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {ratio}%
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Reserve - Liabilities</p>
          <p className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {formatStroops(String(reserve - liabilities))} XLM
          </p>
        </div>
      </div>
    </div>
  );
}
