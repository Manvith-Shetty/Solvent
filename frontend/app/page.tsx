"use client";

import { useEffect, useState } from "react";
import AttestationCard from "./components/AttestationCard";
import FraudDemo from "./components/FraudDemo";
import CustomerCheck from "./components/CustomerCheck";
import {
  CompanyData,
  fetchAllCompanies,
  sortByCoverage,
  coverageRatio,
  formatCoverage,
  formatTimestamp,
  explorerUrl,
} from "./lib/stellar";

export default function Home() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sorted = sortByCoverage(companies);
  const insolventCompanies = sorted.filter(
    (c) => c.attestation && !c.attestation.solvent,
  );

  async function fetchData() {
    try {
      const data = await fetchAllCompanies();
      setCompanies(data);
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const solventCount = companies.filter((c) => c.attestation?.solvent).length;
  const insolventCount = companies.filter((c) => c.attestation && !c.attestation.solvent).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Solvent
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Confidential Proof-of-Reserves on Stellar
            </p>
          </div>
          <a
            href="https://github.com/Manvith-Shetty/Stellar-hacks"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            GitHub
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Real‑World ZK on Stellar
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Live solvency dashboard — every company&apos;s reserve and liabilities are verified
            on-chain using Groth16 ZK proofs. No customer balances are revealed.
          </p>
        </div>

        {/* Summary Stats */}
        {!loading && companies.length > 0 && (
          <div className="mb-8 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {companies.length}
              </p>
              <p className="text-xs text-zinc-500">Companies Tracked</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {solventCount}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Solvent</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{insolventCount}</p>
              <p className="text-xs text-red-600 dark:text-red-500">Insolvent</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-500" />
          </div>
        ) : (
          <>
            {/* Insolvency Alert */}
            {insolventCompanies.length > 0 && (
              <div className="mb-6 rounded-2xl border-2 border-red-400 bg-red-50 p-5 dark:border-red-600 dark:bg-red-900/20">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-xl">🚨</span>
                  <div>
                    <p className="font-bold text-red-800 dark:text-red-300">
                      Insolvency Detected!
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {insolventCompanies
                        .map((c) => c.info.name)
                        .join(", ")}{" "}
                      {insolventCompanies.length === 1 ? "has" : "have"}{" "}
                      insufficient reserves to cover liabilities. Coverage
                      ratio{insolventCompanies.length === 1 ? " is" : "s are"}{" "}
                      below 100%.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Companies Grid — sorted by coverage ratio */}
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Solvency Leaderboard
                </h3>
                <button
                  onClick={() => {
                    setRefreshing(true);
                    fetchData();
                  }}
                  disabled={refreshing}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sorted.map((company, i) => (
                  <div
                    key={company.info.id}
                    className={`rounded-2xl border-2 p-0.5 ${
                      !company.attestation?.solvent
                        ? "border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/20"
                        : i === 0
                          ? "border-yellow-300 bg-yellow-50/50 dark:border-yellow-700 dark:bg-yellow-950/20"
                          : "border-transparent"
                    }`}
                  >
                    <div className="rounded-xl bg-white p-4 dark:bg-zinc-900">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {i === 0 && "🥇 "}
                            {i === 1 && "🥈 "}
                            {i === 2 && "🥉 "}
                            {company.info.name}
                          </h4>
                          <a
                            href={explorerUrl("contract", company.info.contractId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          >
                            {company.info.contractId.slice(0, 12)}…{company.info.contractId.slice(-6)} ↗
                          </a>
                        </div>
                        <span
                          className={`text-xs font-bold ${
                            !company.attestation?.solvent
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCoverage(coverageRatio(company.attestation))}
                        </span>
                      </div>
                      <AttestationCard att={company.attestation} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* How It Works */}
            <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                How It Works
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Generate Proof",
                    desc: "Each issuer runs their private customer ledger through a Circom circuit, producing a Groth16 proof that the sum is correct — without revealing individual balances.",
                  },
                  {
                    step: "2",
                    title: "Verify On-Chain",
                    desc: "The Soroban contract verifies the proof using Stellar's native BLS12-381 host functions, then reads the issuer's real on-chain token balance.",
                  },
                  {
                    step: "3",
                    title: "Record Result",
                    desc: "If reserve ≥ total liabilities → solvent. If not → insolvent. All results are recorded on-chain for anyone to verify.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50"
                  >
                    <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {item.step}
                    </span>
                    <h4 className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
                      {item.title}
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Fraud Demo */}
            <section className="mb-8">
              <FraudDemo />
            </section>

            {/* Customer Check */}
            {companies[0]?.attestation && (
              <section className="mb-8">
                <CustomerCheck
                  att={companies[0].attestation}
                  companyName={companies[0].info.name}
                />
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-sm text-zinc-500">
          <span>Built for Stellar Hacks: Real-World ZK</span>
          <span>Not audited · Proof of Concept</span>
        </div>
      </footer>
    </div>
  );
}
