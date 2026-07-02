"use client";

import { useState } from "react";
import { simulateFraud } from "../lib/stellar";

export default function FraudDemo() {
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function attempt() {
    setRunning(true);
    setMessage(null);
    const res = await simulateFraud();
    setMessage(res.message);
    setRunning(false);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
        The proof is load-bearing
      </h3>
      <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-zinc-400">
        Simulate an issuer understating liabilities by a single stroop. The Groth16 proof commits
        to the honest total, so the contract rejects the claim.
      </p>
      <div className="mt-5">
        <button
          onClick={attempt}
          disabled={running}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
        >
          {running ? "Verifying proof..." : "Attempt fraud"}
        </button>
      </div>
      {message && (
        <pre className="rise mt-5 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-4 font-mono text-xs leading-relaxed text-red-300">
          {message}
        </pre>
      )}
      <p className="mt-auto pt-5 text-xs text-zinc-500">
        Reproduces the on-chain result observed in contract tests and the live testnet deployment.
      </p>
    </div>
  );
}
