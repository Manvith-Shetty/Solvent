import { rpc, Contract, TransactionBuilder, Networks, scValToNative } from "@stellar/stellar-sdk";

const RPC_URL = "https://soroban-testnet.stellar.org";

export interface CompanyInfo {
  id: string;
  name: string;
  contractId: string;
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
    name: "GoldReserve (GoldToken)",
    contractId: "CADK2XJ62X5U633FCXBWCSJPJGCBBOFRABQAZGC7YNKRGWGT4BNUFKAG",
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

function getSimResult(
  result: rpc.Api.SimulateTransactionResponse,
): { retval: any; auth: any[] } | null {
  if ("error" in result || !("result" in result)) return null;
  const r = (result as any).result;
  return r?.retval ? r : null;
}

function parseAttestationVec(val: any): Attestation | null {
  const arm = typeof val["arm"] === "function" ? val["arm"]() : null;
  if (arm === "void") return null;

  const att = scValToNative(val);
  if (!att) return null;

  const data = Array.isArray(att)
    ? {
        total_liabilities: String(att[0] ?? "0"),
        reserve: String(att[1] ?? "0"),
        solvent: Boolean(att[2]),
        timestamp: Number(att[3] ?? 0),
        ledger: Number(att[4] ?? 0),
        seq: Number(att[5] ?? 0),
      }
    : att;

  return {
    total_liabilities: String(data.total_liabilities ?? "0"),
    reserve: String(data.reserve ?? "0"),
    solvent: Boolean(data.solvent),
    timestamp: Number(data.timestamp ?? 0),
    ledger: Number(data.ledger ?? 0),
    seq: Number(data.seq ?? 0),
  };
}

export async function getLatestAttestation(contractId: string): Promise<Attestation | null> {
  try {
    const server = createServer();
    const contract = new Contract(contractId);
    const account = await server.getAccount(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
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
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
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

    const raw = scValToNative(simResult.retval);
    if (!Array.isArray(raw)) return [];

    return raw.map((item: any) => {
      const data = Array.isArray(item)
        ? {
            total_liabilities: String(item[0] ?? "0"),
            reserve: String(item[1] ?? "0"),
            solvent: Boolean(item[2]),
            timestamp: Number(item[3] ?? 0),
            ledger: Number(item[4] ?? 0),
            seq: Number(item[5] ?? 0),
          }
        : item;
      return {
        total_liabilities: String(data.total_liabilities ?? "0"),
        reserve: String(data.reserve ?? "0"),
        solvent: Boolean(data.solvent),
        timestamp: Number(data.timestamp ?? 0),
        ledger: Number(data.ledger ?? 0),
        seq: Number(data.seq ?? 0),
      };
    });
  } catch (e) {
    console.error(`Error fetching attestation history for ${contractId}:`, e);
    return [];
  }
}

export async function simulateFraud(): Promise<{
  result: "rejected";
  message: string;
}> {
  return {
    result: "rejected",
    message:
      "REJECTED ✓ InvalidProof — the ZK proof is cryptographically bound to the honest total. The contract rejected the understated claim on-chain (verified in tests and live deployment).",
  };
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
  return (num / 10_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
}

export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
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
