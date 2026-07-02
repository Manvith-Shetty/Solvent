"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import AlertsFeed from "./components/AlertsFeed";
import CustomerCheck from "./components/CustomerCheck";
import FraudDemo from "./components/FraudDemo";
import Leaderboard from "./components/Leaderboard";
import LiveStatus from "./components/LiveStatus";
import ZkPipeline from "./components/ZkPipeline";
import {
  CompanyData,
  coverageRatio,
  fetchAllCompanies,
  formatCoverage,
  sortByCoverage,
} from "./lib/stellar";

const GITHUB_URL = "https://github.com/Manvith-Shetty/Stellar-hacks";

const PIPELINE_STEPS = [
  {
    title: "Prove",
    body: "The issuer runs its private customer ledger through a Circom circuit and produces a Groth16 proof that the liability total is correct. No individual balance ever leaves the machine.",
    code: "circuits/solvency.circom",
  },
  {
    title: "Verify",
    body: "A Soroban contract checks the proof using Stellar's native BLS12-381 host functions, then reads the issuer's real token balance directly on-chain. No oracle involved.",
    code: "attest()",
  },
  {
    title: "Record",
    body: "Reserves at or above liabilities: solvent. Anything less: insolvent, and the alert feed flags it. Every attestation stays on-chain for anyone to audit.",
    code: "attestations()",
  },
];

const noopSubscribe = () => () => {};

function readNotificationPermission(): NotificationPermission | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export default function Home() {
  const [companies, setCompanies] = useState<CompanyData[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const prevSolvency = useRef<Map<string, boolean>>(new Map());

  // Notification.permission is external browser state; "unsupported" during prerender.
  const [notifOverride, setNotifOverride] = useState<NotificationPermission | null>(null);
  const systemPermission = useSyncExternalStore(
    noopSubscribe,
    readNotificationPermission,
    () => "unsupported" as const,
  );
  const notif = notifOverride ?? systemPermission;

  const loadData = useCallback(async () => {
    try {
      const data = await fetchAllCompanies();
      for (const c of data) {
        if (!c.attestation) continue;
        const wasSolvent = prevSolvency.current.get(c.info.id);
        if (
          wasSolvent === true &&
          !c.attestation.solvent &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(`${c.info.name} is insolvent`, {
              body: `The latest attestation covers ${formatCoverage(
                coverageRatio(c.attestation),
              )} of liabilities.`,
            });
          } catch (e) {
            console.error("Notification failed:", e);
          }
        }
        prevSolvency.current.set(c.info.id, c.attestation.solvent);
      }
      setCompanies(data);
      setUpdatedAt(new Date());
    } catch (e) {
      console.error("Failed to fetch companies:", e);
      setCompanies((prev) => prev ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(loadData, 0);
    const interval = setInterval(loadData, 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [loadData]);

  async function enableNotifications() {
    setNotifOverride(await Notification.requestPermission());
  }

  const loading = companies === null;
  const sorted = companies ? sortByCoverage(companies) : [];
  const attested = sorted.filter((c) => c.attestation);
  const insolvent = attested.filter((c) => !c.attestation!.solvent);
  const rpcUnreachable = !loading && sorted.length > 0 && attested.length === 0;

  const alertText =
    insolvent.length === 1
      ? `${insolvent[0].info.name}'s latest proof covers only ${formatCoverage(
          coverageRatio(insolvent[0].attestation),
        )} of liabilities.`
      : `${insolvent.map((c) => c.info.name).join(", ")} are attesting reserves below liabilities.`;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400 text-sm font-bold text-zinc-950">
              S
            </span>
            <span className="font-semibold tracking-tight text-zinc-100">Solvent</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
            <a href="#leaderboard" className="transition-colors hover:text-zinc-100">
              Leaderboard
            </a>
            <a href="#alerts" className="transition-colors hover:text-zinc-100">
              Alerts
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-zinc-100">
              How it works
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-100"
            >
              GitHub ↗
            </a>
          </nav>
          <p className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="live-pulse h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            Live on testnet
          </p>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-8 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:gap-16 lg:pb-10">
          <div>
            <p className="rise font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
              Confidential proof of reserves
            </p>
            <h1
              className="rise mt-4 text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl"
              style={{ "--rise-i": 1 } as React.CSSProperties}
            >
              <span className="block">Reserves proven.</span>
              <span className="block text-zinc-500">Balances private.</span>
            </h1>
            <p
              className="rise mt-5 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg"
              style={{ "--rise-i": 2 } as React.CSSProperties}
            >
              Solvent ranks Stellar issuers by live, zero-knowledge-verified coverage and raises an
              alert the moment reserves fall short.
            </p>
            <div
              className="rise mt-8 flex flex-wrap items-center gap-3"
              style={{ "--rise-i": 3 } as React.CSSProperties}
            >
              <a
                href="#leaderboard"
                className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 active:scale-[0.98]"
              >
                View leaderboard
              </a>
              <a
                href="#how-it-works"
                className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 active:scale-[0.98]"
              >
                How it works
              </a>
            </div>
          </div>
          <LiveStatus companies={companies} />
        </section>

        {/* ZK pipeline: how a solvency proof moves, animated */}
        <div
          className="rise mx-auto max-w-6xl px-4 pb-10 sm:px-6"
          style={{ "--rise-i": 4 } as React.CSSProperties}
        >
          <ZkPipeline />
        </div>

        {/* Active insolvency alert */}
        {insolvent.length > 0 && (
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="rise flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4">
              <span className="inline-flex rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                Active alert
              </span>
              <p className="text-sm text-red-200">{alertText}</p>
              <a
                href="#alerts"
                className="text-sm font-medium text-red-300 underline-offset-4 hover:underline sm:ml-auto"
              >
                See alert feed
              </a>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <section id="leaderboard" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                Leaderboard
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Issuers ranked by proven coverage: on-chain reserves against zero-knowledge-attested
                liabilities. Select a row for the full attestation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {updatedAt && (
                <span className="font-mono text-xs text-zinc-500">
                  Updated {updatedAt.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => {
                  setRefreshing(true);
                  loadData();
                }}
                disabled={refreshing || loading}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 active:scale-[0.98] disabled:opacity-50"
              >
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </div>
          {rpcUnreachable && (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4">
              <p className="text-sm text-zinc-400">
                <span className="font-medium text-red-400">Connection issue.</span> None of the
                tracked contracts returned an attestation. The Stellar testnet RPC may be
                unreachable; retrying automatically.
              </p>
            </div>
          )}
          <div className="mt-6">
            <Leaderboard companies={sorted} loading={loading} />
          </div>
        </section>

        {/* Alerts */}
        <section id="alerts" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
                Alert feed
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Every attestation across tracked issuers, newest first. Failed coverage is flagged
                the moment it lands on-chain.
              </p>
            </div>
            {notif === "default" && (
              <button
                onClick={enableNotifications}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 active:scale-[0.98]"
              >
                Enable browser alerts
              </button>
            )}
            {notif === "granted" && (
              <span className="text-xs font-medium text-emerald-400">Browser alerts on</span>
            )}
            {notif === "denied" && (
              <span className="text-xs text-zinc-500">Notifications blocked in browser settings</span>
            )}
          </div>
          <div className="mt-6">
            <AlertsFeed />
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            How a proof lands on-chain
          </h2>
          <div className="mt-8 divide-y divide-zinc-800 border-t border-zinc-800">
            {PIPELINE_STEPS.map((step) => (
              <div
                key={step.title}
                className="grid gap-3 py-8 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:gap-10"
              >
                <h3 className="text-xl font-semibold tracking-tight text-zinc-100">
                  {step.title}
                </h3>
                <p className="max-w-[65ch] text-sm leading-relaxed text-zinc-400">{step.body}</p>
                <code className="justify-self-start self-start rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 font-mono text-xs text-zinc-400 md:justify-self-end">
                  {step.code}
                </code>
              </div>
            ))}
          </div>
        </section>

        {/* Verify it yourself */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            Verify it yourself
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Poke at the system: try to forge a proof, or test whether a balance fits the attested
            total.
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <FraudDemo />
            </div>
            <div className="lg:col-span-2">
              <CustomerCheck
                att={attested[0]?.attestation ?? null}
                companyName={attested[0]?.info.name}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Solvent, built for Stellar Hacks: Real-World ZK.</p>
          <p className="flex items-center gap-5">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-300"
            >
              GitHub ↗
            </a>
            <span>Proof of concept, not audited.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
