"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FeedEvent,
  fetchAlertFeed,
  coverageRatio,
  formatCoverage,
  formatTimestamp,
  relativeTime,
} from "../lib/stellar";

function eventKey(event: FeedEvent): string {
  return `${event.company.id}-${event.att.seq}-${event.att.ledger}`;
}

function eventMessage(event: FeedEvent): string {
  const coverage = formatCoverage(coverageRatio(event.att));
  if (event.att.solvent) {
    return `Attestation #${event.att.seq} verified on ledger ${event.att.ledger.toLocaleString(
      "en-US",
    )}. Coverage ${coverage}.`;
  }
  return `Attestation #${event.att.seq} shows reserves at ${coverage} of liabilities.`;
}

function SkeletonFeed() {
  return (
    <ul className="divide-y divide-zinc-800" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="grid animate-pulse gap-2 px-4 py-4 md:grid-cols-[7rem_1fr] md:gap-6 md:px-5">
          <span className="h-3 w-16 rounded bg-zinc-800/70" />
          <span className="space-y-2">
            <span className="block h-4 w-40 rounded bg-zinc-800" />
            <span className="block h-3 w-72 max-w-full rounded bg-zinc-800/70" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AlertsFeed() {
  const [events, setEvents] = useState<FeedEvent[] | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await fetchAlertFeed(12));
    } catch (e) {
      console.error("Failed to load alert feed:", e);
      setEvents((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(load, 0);
    const interval = setInterval(load, 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [load]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      {events === null ? (
        <SkeletonFeed />
      ) : events.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          No attestations in the feed yet. If this persists, the testnet RPC may be unreachable.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800">
          {events.map((event, i) => (
            <li
              key={eventKey(event)}
              className="rise grid gap-1 px-4 py-4 md:grid-cols-[7rem_1fr] md:gap-6 md:px-5"
              style={{ "--rise-i": i } as React.CSSProperties}
            >
              <time
                dateTime={new Date(event.att.timestamp * 1000).toISOString()}
                title={formatTimestamp(event.att.timestamp)}
                className="pt-0.5 font-mono text-xs text-zinc-500"
              >
                {relativeTime(event.att.timestamp)}
              </time>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-zinc-100">
                  {event.company.name}
                  {!event.att.solvent && (
                    <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
                      Alert
                    </span>
                  )}
                </p>
                <p className={`mt-0.5 text-sm ${event.att.solvent ? "text-zinc-400" : "text-red-300"}`}>
                  {eventMessage(event)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
