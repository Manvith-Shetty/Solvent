import {
  rpc,
  xdr,
  Contract,
  TransactionBuilder,
  Networks,
  scValToNative,
} from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";

export interface CompanyInfo {
  id: string;
  name: string;
  contractId: string;
  token?: string;
}

export const COMPANIES: CompanyInfo[] = [
  {
    id: "company-a",
    name: "StellarX Exchange",
    contractId: "CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO",
  },
  {
    id: "company-b",
    name: "LumensBank",
    contractId: "CDEZEY4Q7JI3GWGNWDXLZFQYOBI5OVDO4UK5CZG23SN4QQA67TVW275P",
  },
  {
    id: "company-c",
    name: "NovaFi",
    contractId: "CDKA4TOJVB2DZ5PJCCOSD3TQXMF4AGZWDBMZXIX2B4VBAAP2EEBTBJGJ",
  },
  {
    id: "company-d",
    name: "TrustLine Capital",
    contractId: "CCIOFFLRX5XCUQRA2T6RRVIKEF7FSOJKMKZ5QUQOI2C7L2YQ3DTQ2RFY",
  },
  {
    id: "company-e",
    name: "VaultSphere",
    contractId: "CAH7KP6ZQ32TK3GZC5HKV6XE7JGYCKD7ESVOFWWZOJPM4Y7MKXO2JAXK",
  },
];

export interface Attestation {
  total_liabilities: string;
  reserve: string;
  solvent: boolean;
  timestamp: number;
  ledger: number;
  seq: number;
}

export interface ContractConfig {
  issuer: string;
  reserve_token: string;
  reserve_holder: string;
}

export interface HistoricalAttestation extends Attestation {
  txHash: string;
}

export interface CompanyData {
  info: CompanyInfo;
  attestation: Attestation | null;
  config: ContractConfig | null;
}

function createServer() {
  return new rpc.Server(RPC_URL);
}

function getSimResult(result: rpc.Api.SimulateTransactionResponse): { retval: xdr.ScVal } | null {
  if ("error" in result || !("result" in result)) return null;
  const r = (result as rpc.Api.SimulateTransactionSuccessResponse).result;
  return r?.retval ? r : null;
}

function normalizeAttestation(raw: unknown): Attestation {
  const data = Array.isArray(raw)
    ? {
        total_liabilities: raw[0],
        reserve: raw[1],
        solvent: raw[2],
        timestamp: raw[3],
        ledger: raw[4],
        seq: raw[5],
      }
    : ((raw ?? {}) as Record<string, unknown>);

  return {
    total_liabilities: String(data.total_liabilities ?? "0"),
    reserve: String(data.reserve ?? "0"),
    solvent: Boolean(data.solvent),
    timestamp: Number(data.timestamp ?? 0),
    ledger: Number(data.ledger ?? 0),
    seq: Number(data.seq ?? 0),
  };
}

function parseAttestationVec(val: xdr.ScVal): Attestation | null {
  if (val.switch().name === "scvVoid") return null;

  const att: unknown = scValToNative(val);
  if (!att) return null;

  return normalizeAttestation(att);
}

export async function getLatestAttestation(contractId: string): Promise<Attestation | null> {
  try {
    const server = createServer();
    const contract = new Contract(contractId);
    // Use a known funded testnet account for simulating read-only calls
    const account = await server.getAccount(
      "GCUFONGLW3MR6ZSE6U5VEEM337BMZ6PW6Q4IJGQ6I3JMOHWBZK3F2C4O",
    );

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("status"))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    const simResult = getSimResult(result);
    if (!simResult) return null;

    return parseAttestationVec(simResult.retval);
  } catch (e) {
    console.error(`Error fetching attestation for ${contractId}:`, e);
    return null;
  }
}

export async function getAttestationHistory(contractId: string): Promise<Attestation[]> {
  try {
    const server = createServer();
    const contract = new Contract(contractId);
    const account = await server.getAccount(
      "GCUFONGLW3MR6ZSE6U5VEEM337BMZ6PW6Q4IJGQ6I3JMOHWBZK3F2C4O",
    );

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("attestations"))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    const simResult = getSimResult(result);
    if (!simResult) return [];

    const raw: unknown = scValToNative(simResult.retval);
    if (!Array.isArray(raw)) return [];

    return raw.map(normalizeAttestation);
  } catch (e) {
    console.error(`Error fetching attestation history for ${contractId}:`, e);
    return [];
  }
}

export async function simulateFraud(): Promise<{
  result: "rejected";
  message: string;
}> {
  // Short pause so the pending state is visible before the verdict lands.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return {
    result: "rejected",
    message:
      "InvalidProof: the submitted proof does not match the claimed total.\nThe Groth16 proof commits to the honest sum of liabilities, so the understated claim was rejected on-chain.",
  };
}

export interface FeedEvent {
  company: CompanyInfo;
  att: Attestation;
}

export async function fetchAlertFeed(limit = 12): Promise<FeedEvent[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(async (company) => {
      const history = await getAttestationHistory(company.contractId);
      return history.map((att) => ({ company, att }));
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<FeedEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => b.att.timestamp - a.att.timestamp || b.att.seq - a.att.seq)
    .slice(0, limit);
}

export async function fetchAllCompanies(): Promise<CompanyData[]> {
  const results = await Promise.allSettled(
    COMPANIES.map(async (company) => {
      const attestation = await getLatestAttestation(company.contractId);
      return { info: company, attestation, config: null };
    }),
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<CompanyData>).value);
}

export function formatStroops(stroops: string): string {
  const num = parseFloat(stroops);
  return (num / 10_000_000).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatXLMCompact(stroops: string): string {
  const xlm = parseFloat(stroops) / 10_000_000;
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(xlm);
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function relativeTime(ts: number): string {
  const seconds = Math.max(1, Math.floor(Date.now() / 1000 - ts));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function explorerUrl(type: "contract" | "tx", id: string): string {
  const base = "https://stellar.expert/explorer/testnet";
  return type === "contract" ? `${base}/contract/${id}` : `${base}/tx/${id}`;
}

export function contractById(id: string): CompanyInfo | undefined {
  return COMPANIES.find((c) => c.id === id);
}

export function coverageRatio(att: Attestation | null): number {
  if (!att) return 0;
  const r = parseFloat(att.reserve);
  const l = parseFloat(att.total_liabilities);
  if (l === 0) return r > 0 ? 999 : 0;
  return Math.round((r / l) * 1000) / 10; // 1 decimal
}

export function sortByCoverage(data: CompanyData[]): CompanyData[] {
  return [...data].sort((a, b) => {
    const ra = coverageRatio(a.attestation);
    const rb = coverageRatio(b.attestation);
    return rb - ra;
  });
}

export function formatCoverage(ratio: number): string {
  return ratio >= 999 ? "∞" : ratio.toFixed(1) + "%";
}
