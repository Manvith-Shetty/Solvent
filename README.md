# Solvent — Confidential Proof-of-Reserves on Stellar

**Demo video:** [Add your video link here]

An issuer proves **on-chain reserves ≥ customer liabilities** without revealing a single customer balance — verified inside a Soroban smart contract on Stellar using Groth16 ZK proofs and Stellar's native BLS12-381 host functions.

Built for **Stellar Hacks: Real-World ZK**.

---

## 🚀 Live on Testnet

| Company               | Contract                                                                                                                       | Reserve   | Owes           | Status           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | -------------- | ---------------- |
| **StellarX Exchange** | [`CA3RMVFY…CKWZFO`](https://stellar.expert/explorer/testnet/contract/CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO) | 9,999 XLM | 2,800 XLM      | ✅ SOLVENT       |
| **LumensBank**        | [`CDEZEY4Q…W275P`](https://stellar.expert/explorer/testnet/contract/CDEZEY4Q7JI3GWGNWDXLZFQYOBI5OVDO4UK5CZG23SN4QQA67TVW275P)  | 9,999 XLM | 2,800 XLM      | ✅ SOLVENT       |
| **NovaFi**            | [`CDKA4TOJ…TBJGJ`](https://stellar.expert/explorer/testnet/contract/CDKA4TOJVB2DZ5PJCCOSD3TQXMF4AGZWDBMZXIX2B4VBAAP2EEBTBJGJ)  | 9,999 XLM | **27,000 XLM** | ❌ **INSOLVENT** |
| **TrustLine Capital** | [`CCIOFFL…2RFY`](https://stellar.expert/explorer/testnet/contract/CCIOFFLRX5XCUQRA2T6RRVIKEF7FSOJKMKZ5QUQOI2C7L2YQ3DTQ2RFY)    | 9,999 XLM | 2,800 XLM      | ✅ SOLVENT       |
| **VaultSphere**       | [`CAH7KP6…JAXK`](https://stellar.expert/explorer/testnet/contract/CAH7KP6ZQ32TK3GZC5HKV6XE7JGYCKD7ESVOFWWZOJPM4Y7MKXO2JAXK)    | 9,999 XLM | **27,000 XLM** | ❌ **INSOLVENT** |

---

## 🧠 Problem / Solution

Exchanges collapse because nobody can verify they hold customer funds. Current "Proof of Reserves" leaks balances or is unverifiable.

**Solvent** splits `reserve ≥ liabilities`:

- **Reserve** → live on-chain token balance (no oracle)
- **Liabilities** → Groth16 ZK proof (private ledger sums to public total)

The ZK is **load-bearing**: understate the total → **InvalidProof** on-chain.

---

## ⚡ Features

- **ZK circuit** — Circom 2.0, Groth16, BLS12-381
- **Soroban contract** — 6 entry points: `init`, `attest`, `status`, `solvent`, `attestations`, `config`
- **On-chain history** — stores last 20 attestations per contract
- **Multi-asset** — works with XLM, USDC, or custom tokens
- **Fraud detection** — understated liabilities → `InvalidProof`
- **4 companies live** — 3 solvent, 1 insolvent
- **Dashboard** — Next.js UI with leaderboard + insolvency alerts

---

## 🏃 Quick Start

```bash
# Full demo (changes balances → ZK proof → real on-chain attestation → fraud demo)
bash demo.sh

# Or start the dashboard
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

---

## 📁 Structure

```
circuits/           ZK circuit (Circom) + proofs
contracts/          Soroban smart contract (Rust)
frontend/           Next.js dashboard
deploy/             Deployment scripts
tools/convert/      Proof format converter
scripts/            Proving pipeline
```

---

## 🛠 Tech

Circom 2 · snarkjs · Groth16 · BLS12-381 · arkworks · Soroban (soroban-sdk 25) · Stellar Asset Contract · Next.js · Tailwind

_Not audited. Hackathon PoC._

Circom 2 · snarkjs · Groth16 · **BLS12-381** · arkworks · Soroban
(`soroban-sdk` 25) · Stellar Asset Contract · Stellar CLI.

_Not audited. For the Stellar "Real-World ZK" hackathon._
