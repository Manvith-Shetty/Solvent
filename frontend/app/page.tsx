"use client";

import { useEffect, useState } from "react";
import AttestationCard from "./components/AttestationCard";
import {
  Attestation,
  ContractConfig,
  getLatestAttestation,
  getContractConfig,
  formatTimestamp,
  explorerUrl,
} from "./lib/stellar";

export default function Home() {
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [config, setConfig] = useState<ContractConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      setError(null);
      const [att, cfg] = await Promise.all([getLatestAttestation(), getContractConfig()]);
      setAttestation(att);
      setConfig(cfg);
    } catch (e) {
      setError("Failed to fetch data from Stellar testnet.");
      console.error(e);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
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

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Real‑World ZK on Stellar
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            An issuer proves on-chain reserves ≥ customer liabilities without revealing a single
            customer balance — verified inside a Soroban smart contract using Groth16 proofs and
            Stellar&apos;s native BLS12-381 host functions.
          </p>
        </div>

        {/* Contract Info */}
        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Contract</span>
            <a
              href={explorerUrl(
                "contract",
                "CBNMJDIEVKLVP2N6XVUCWDQATOXUVQ743C6W3BYYJMIMNFPBRWWGNLJG",
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              CBNMJDIE…GNLJG ↗
            </a>
          </div>
          {config && (
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-400">
              <span>Issuer: {config.issuer.slice(0, 12)}…</span>
              <span>Network: Stellar Testnet</span>
            </div>
          )}
        </div>

        {/* Status */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-500" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => {
                setRefreshing(true);
                fetchData();
              }}
              className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-800/30 dark:text-red-400 dark:hover:bg-red-800/50"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Latest Attestation
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
              <AttestationCard att={attestation} />
            </section>

            <section className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                How It Works
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    step: "1",
                    title: "Generate Proof",
                    desc: "The issuer runs the private customer ledger through a Circom circuit, producing a Groth16 proof that the sum is correct — without revealing individual balances.",
                  },
                  {
                    step: "2",
                    title: "Verify On-Chain",
                    desc: "The Soroban contract verifies the proof using Stellar's native BLS12-381 host functions, then reads the issuer's real on-chain token balance.",
                  },
                  {
                    step: "3",
                    title: "Record Result",
                    desc: "If reserve ≥ total liabilities → solvent. If not → insolvent. The result is recorded on-chain for anyone to verify.",
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

            {attestation && (
              <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Live Demo
                </h3>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  This contract is live on Stellar testnet. The attestation above was verified
                  on-chain.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={explorerUrl(
                      "contract",
                      "CBNMJDIEVKLVP2N6XVUCWDQATOXUVQ743C6W3BYYJMIMNFPBRWWGNLJG",
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    View on Explorer ↗
                  </a>
                </div>
                {attestation && (
                  <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
                    <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Latest On-Chain Data
                    </p>
                    <pre className="overflow-x-auto text-xs text-zinc-600 dark:text-zinc-400">
                      {JSON.stringify(
                        {
                          ledger: attestation.ledger,
                          reserve: attestation.reserve,
                          seq: attestation.seq,
                          solvent: attestation.solvent,
                          timestamp: formatTimestamp(attestation.timestamp),
                          total_liabilities: attestation.total_liabilities,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 text-sm text-zinc-500">
          <span>Built for Stellar Hacks: Real-World ZK</span>
          <span>Not audited · Proof of Concept</span>
        </div>
      </footer>
    </div>
  );
}
