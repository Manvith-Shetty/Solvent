"use client";

import { useState } from "react";
import { simulateFraud } from "../lib/stellar";

export default function FraudDemo() {
  const [result, setResult] = useState<{
    result: "rejected";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFraud() {
    setLoading(true);
    setResult(null);
    const res = await simulateFraud();
    setResult(res);
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6 dark:border-red-800 dark:bg-zinc-900">
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        ⚡ Fraud Detection Demo
      </h3>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Click the button to simulate an issuer trying to understate their liabilities by 1 stroop.
        The contract will reject the proof — proving the ZK is load-bearing.
      </p>

      <button
        onClick={handleFraud}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Simulating…
          </>
        ) : (
          "🚫 Attempt Fraud"
        )}
      </button>

      {result && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-mono text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800">
          <div>{result.message}</div>
        </div>
      )}
    </div>
  );
}
