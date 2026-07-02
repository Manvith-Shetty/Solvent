"use client";

import { CompanyData, relativeTime } from "../lib/stellar";

function StatRow({
  label,
  value,
  tone = "text-zinc-100",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-zinc-400">{label}</dt>
      <dd className={`text-right font-mono text-sm tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

export default function LiveStatus({ companies }: { companies: CompanyData[] | null }) {
  if (companies === null) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-2" aria-hidden>
        <div className="divide-y divide-zinc-800">
          <div className="flex items-center justify-between py-3.5">
            <span className="h-4 w-36 rounded bg-zinc-800" />
            <span className="h-3 w-12 rounded bg-zinc-800/70" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3.5">
              <span className="h-3.5 w-28 rounded bg-zinc-800/70" />
              <span className="h-3.5 w-16 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const attested = companies.filter((c) => c.attestation);
  const solventCount = attested.filter((c) => c.attestation!.solvent).length;
  const alertCount = attested.length - solventCount;
  const latest = attested.reduce<CompanyData | null>(
    (best, c) =>
      !best || c.attestation!.timestamp > best.attestation!.timestamp ? c : best,
    null,
  );

  return (
    <div className="rise rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-2">
      <dl className="divide-y divide-zinc-800">
        <div className="flex items-center justify-between py-3">
          <p className="text-sm font-medium text-zinc-100">Live attestation status</p>
          <span className="font-mono text-xs text-zinc-500">testnet</span>
        </div>
        <StatRow label="Issuers tracked" value={String(companies.length)} />
        <StatRow label="Proven solvent" value={String(solventCount)} tone="text-emerald-400" />
        <StatRow
          label="Active alerts"
          value={String(alertCount)}
          tone={alertCount > 0 ? "text-red-400" : "text-zinc-100"}
        />
        <StatRow
          label="Latest attestation"
          value={
            latest
              ? `${latest.info.name}, ${relativeTime(latest.attestation!.timestamp)}`
              : "None yet"
          }
        />
      </dl>
    </div>
  );
}
