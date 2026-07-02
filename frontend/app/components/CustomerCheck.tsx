"use client";

import { useState } from "react";
import { Attestation, formatStroops } from "../lib/stellar";

export default function CustomerCheck({
  att,
  companyName,
}: {
  att: Attestation | null;
  companyName?: string;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"included" | "excluded" | "invalid" | null>(null);

  if (!att) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
        <p className="text-sm text-zinc-500">
          Waiting for live attestation data before balances can be checked.
        </p>
      </div>
    );
  }

  const totalStroops = parseFloat(att.total_liabilities);

  function check() {
    const val = Number(value);
    if (!Number.isFinite(val) || val <= 0) {
      setResult("invalid");
      return;
    }
    setResult(val <= totalStroops ? "included" : "excluded");
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-100">Check your balance</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        {companyName ?? "The top-ranked issuer"} has proven total liabilities of{" "}
        <span className="font-mono text-zinc-200">{formatStroops(att.total_liabilities)} XLM</span>.
        Enter a balance to confirm it could fit inside that total.
      </p>

      <div className="mt-5">
        <label htmlFor="customer-balance" className="block text-sm font-medium text-zinc-300">
          Balance in stroops
        </label>
        <input
          id="customer-balance"
          type="number"
          inputMode="numeric"
          placeholder="2500000000"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult(null);
          }}
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
        />
        <p className="mt-2 text-xs text-zinc-500">1 XLM = 10,000,000 stroops.</p>
        {result === "invalid" && (
          <p className="mt-2 text-xs text-red-400">Enter a positive number of stroops.</p>
        )}
      </div>

      <div className="mt-4">
        <button
          onClick={check}
          disabled={!value}
          className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-50"
        >
          Check inclusion
        </button>
      </div>

      {result === "included" && (
        <div className="rise mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          This balance fits inside the proven total. In production you would confirm inclusion
          with a Merkle proof.
        </div>
      )}
      {result === "excluded" && (
        <div className="rise mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          This balance exceeds the proven total, so it cannot be part of this attestation.
        </div>
      )}
    </div>
  );
}
