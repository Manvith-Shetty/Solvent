"use client";

import { useState } from "react";
import {
  CompanyData,
  coverageRatio,
  formatCoverage,
  formatStroops,
  formatTimestamp,
  formatXLMCompact,
  explorerUrl,
} from "../lib/stellar";

const ROW_GRID =
  "grid-cols-[2rem_minmax(0,1fr)_4.5rem_1rem] md:grid-cols-[3rem_minmax(0,1fr)_8rem_8rem_6.5rem_6.5rem_1.5rem]";

function shortId(id: string): string {
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function StatusTag({ att }: { att: CompanyData["attestation"] }) {
  if (!att) {
    return (
      <span className="inline-flex rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
        No data
      </span>
    );
  }
  return att.solvent ? (
    <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
      Solvent
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
      Insolvent
    </span>
  );
}

function ExpandedDetail({ company }: { company: CompanyData }) {
  const att = company.attestation;
  if (!att) {
    return (
      <div className="border-t border-zinc-800 bg-zinc-950/60 px-4 py-5 md:px-5">
        <p className="text-sm text-zinc-500">
          This contract has not recorded an attestation yet. It joins the ranking with its first
          verified proof.
        </p>
      </div>
    );
  }

  const reserve = parseFloat(att.reserve);
  const liabilities = parseFloat(att.total_liabilities);
  const surplus = reserve - liabilities;

  const fields: Array<[string, string]> = [
    ["Attestation", `#${att.seq}`],
    ["Ledger", att.ledger.toLocaleString("en-US")],
    ["Recorded", formatTimestamp(att.timestamp)],
    ["Reserve", `${formatStroops(att.reserve)} XLM`],
    ["Liabilities", `${formatStroops(att.total_liabilities)} XLM`],
    [surplus >= 0 ? "Surplus" : "Shortfall", `${formatStroops(String(Math.abs(surplus)))} XLM`],
  ];

  return (
    <div className="rise border-t border-zinc-800 bg-zinc-950/60 px-4 py-5 md:px-5">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd
              className={`mt-0.5 font-mono text-sm tabular-nums ${
                label === "Shortfall" ? "text-red-400" : "text-zinc-200"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {!att.solvent && (
        <p className="mt-4 text-sm text-red-300">
          The latest verified proof shows reserves below attested liabilities.
        </p>
      )}
      <a
        href={explorerUrl("contract", company.info.contractId)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-sm font-medium text-emerald-400 underline-offset-4 hover:underline"
      >
        View contract on stellar.expert ↗
      </a>
    </div>
  );
}

function Row({
  company,
  rank,
  open,
  onToggle,
}: {
  company: CompanyData;
  rank: number;
  open: boolean;
  onToggle: () => void;
}) {
  const att = company.attestation;
  const ratio = coverageRatio(att);
  const coverageColor = !att
    ? "text-zinc-500"
    : att.solvent
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <li className="rise" style={{ "--rise-i": rank } as React.CSSProperties}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`grid w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-zinc-900/70 md:gap-4 md:px-5 ${ROW_GRID}`}
      >
        <span className="font-mono text-sm text-zinc-500 tabular-nums">
          {String(rank).padStart(2, "0")}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-zinc-100">{company.info.name}</span>
          <span className="block truncate font-mono text-xs text-zinc-500">
            {shortId(company.info.contractId)}
          </span>
        </span>
        <span className="hidden text-right font-mono text-sm text-zinc-300 tabular-nums md:block">
          {att ? `${formatXLMCompact(att.reserve)} XLM` : "-"}
        </span>
        <span className="hidden text-right font-mono text-sm text-zinc-300 tabular-nums md:block">
          {att ? `${formatXLMCompact(att.total_liabilities)} XLM` : "-"}
        </span>
        <span className={`text-right font-mono text-base tabular-nums ${coverageColor}`}>
          {att ? formatCoverage(ratio) : "-"}
        </span>
        <span className="hidden text-right md:block">
          <StatusTag att={att} />
        </span>
        <span
          aria-hidden
          className={`text-center font-mono text-zinc-600 transition-transform duration-300 ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {open && <ExpandedDetail company={company} />}
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="divide-y divide-zinc-800" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className={`grid animate-pulse items-center gap-3 px-4 py-4 md:gap-4 md:px-5 ${ROW_GRID}`}
        >
          <span className="h-4 w-6 rounded bg-zinc-800" />
          <span className="space-y-2">
            <span className="block h-4 w-36 rounded bg-zinc-800" />
            <span className="block h-3 w-24 rounded bg-zinc-800/70" />
          </span>
          <span className="hidden h-4 rounded bg-zinc-800 md:block" />
          <span className="hidden h-4 rounded bg-zinc-800 md:block" />
          <span className="h-4 rounded bg-zinc-800" />
          <span className="hidden h-5 rounded-full bg-zinc-800 md:block" />
          <span />
        </li>
      ))}
    </ul>
  );
}

export default function Leaderboard({
  companies,
  loading,
}: {
  companies: CompanyData[];
  loading: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div
        className={`hidden gap-4 border-b border-zinc-800 px-5 py-3 text-xs text-zinc-500 md:grid ${ROW_GRID}`}
        aria-hidden
      >
        <span>Rank</span>
        <span>Issuer</span>
        <span className="text-right">Reserve</span>
        <span className="text-right">Liabilities</span>
        <span className="text-right">Coverage</span>
        <span className="text-right">Status</span>
        <span />
      </div>
      {loading ? (
        <SkeletonRows />
      ) : companies.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          No issuers are being tracked yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {companies.map((company, i) => (
            <Row
              key={company.info.id}
              company={company}
              rank={i + 1}
              open={openId === company.info.id}
              onToggle={() =>
                setOpenId(openId === company.info.id ? null : company.info.id)
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
