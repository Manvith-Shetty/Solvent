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
  const [inputBalance, setInputBalance] = useState("");
  const [result, setResult] = useState<"included" | "excluded" | null>(null);

  if (!att) return null;

  const totalStroops = parseFloat(att.total_liabilities);
  const maxBalance = totalStroops;

  function handleCheck() {
    const val = parseFloat(inputBalance);
    if (isNaN(val) || val <= 0) return;

    // The customer's balance could be anywhere from 1 to the total
    // Since we don't have the actual list (it's private!), we check if
    // the entered amount is plausibly included (≤ total and reasonable)
    if (val > 0 && val <= maxBalance) {
      setResult("included");
    } else {
      setResult("excluded");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        🧑 Customer Balance Check
      </h3>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        The issuer&apos;s total proven liabilities are{" "}
        <strong>{formatStroops(att.total_liabilities)} XLM</strong>. Enter a balance to verify it
        could be included.
      </p>

      <div className="flex items-center gap-3">
        <input
          type="number"
          placeholder="Enter balance in stroops (e.g. 5000000000)"
          value={inputBalance}
          onChange={(e) => {
            setInputBalance(e.target.value);
            setResult(null);
          }}
          className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <button
          onClick={handleCheck}
          disabled={!inputBalance}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Check
        </button>
      </div>

      {result === "included" && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
          ✅ This balance <strong>could be included</strong> in the attested total (it is ≤ the
          total liabilities of {formatStroops(att.total_liabilities)} XLM).
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
            In production, you would verify a Merkle inclusion proof to be certain.
          </p>
        </div>
      )}
      {result === "excluded" && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800">
          ❌ This balance <strong>exceeds</strong> the total proven liabilities. It cannot be part
          of this attestation.
        </div>
      )}
    </div>
  );
}
