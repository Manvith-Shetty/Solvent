const LEDGER_ROWS = ["GDK4…R7QI", "GBXN…M2LP", "GCV8…T4EA"];

function Connector({ dot }: { dot: string }) {
  return (
    <span className="relative hidden h-2 min-w-6 flex-1 md:block">
      <span className="absolute inset-x-0 top-1/2 h-px bg-zinc-800" />
      <span className={`${dot} absolute inset-0`}>
        <span className="absolute left-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-emerald-400" />
      </span>
    </span>
  );
}

export default function ZkPipeline() {
  return (
    <div
      aria-hidden
      className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-5 md:flex md:items-center md:gap-6"
    >
      <div className="shrink-0">
        <p className="text-xs text-zinc-500">Private ledger</p>
        <div className="mt-2 space-y-1">
          {LEDGER_ROWS.map((addr, i) => (
            <p
              key={addr}
              className="zkp-scan font-mono text-xs text-zinc-400"
              style={{ "--zkp-i": i } as React.CSSProperties}
            >
              {addr} <span className="text-zinc-600">••••••</span>
            </p>
          ))}
        </div>
      </div>

      <Connector dot="zkp-dot1" />

      <div className="flex shrink-0 items-center gap-3">
        <span className="zkp-proof-glyph inline-block font-mono text-2xl text-emerald-400">π</span>
        <div>
          <p className="text-xs text-zinc-500">Groth16 proof</p>
          <p className="mt-1 font-mono text-xs text-zinc-400">solvency.circom</p>
          <p className="font-mono text-xs text-zinc-600">balances stay hidden</p>
        </div>
      </div>

      <Connector dot="zkp-dot2" />

      <div className="relative shrink-0">
        <span className="zkp-ring pointer-events-none absolute -inset-3 rounded-xl border border-emerald-400/50" />
        <p className="text-xs text-zinc-500">Soroban contract</p>
        <p className="mt-1 font-mono text-xs text-zinc-400">attest()</p>
        <p className="font-mono text-xs text-zinc-600">BLS12-381 verify</p>
      </div>

      <Connector dot="zkp-dot3" />

      <div className="shrink-0">
        <p className="text-xs text-zinc-500">Attestation</p>
        <span className="zkp-result mt-2 inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          Solvent
        </span>
        <p className="mt-1.5 font-mono text-xs text-zinc-600">recorded on-chain</p>
      </div>
    </div>
  );
}
