# Solvent — Confidential Proof-of-Reserves on Stellar

> An issuer proves **on-chain reserves ≥ customer liabilities** without revealing
> a single customer balance. The reserve is a *real* on-chain token balance (no
> oracle to trust); the liabilities are proven in zero-knowledge and verified
> **inside a Soroban smart contract** on Stellar.

Built for **Stellar Hacks: Real-World ZK**. Live on testnet — the full
happy-path *and* a fraud-rejection are demonstrated on-chain in
[`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md).

---

## The problem

Every time an exchange or stablecoin issuer collapses (FTX, Celsius, …), the
same question comes too late: *did they actually hold what they owed customers?*

The industry answer is "Proof of Reserves." Today it is broken in two ways:

1. **It leaks everyone's balances.** Naive Merkle-tree PoR publishes enough to
   let competitors and attackers reconstruct customer holdings.
2. **The liabilities side is unverifiable.** An issuer can quietly *understate*
   what it owes — showing a big reserve while hiding the true, larger liability.
   The reserve number is auditable; the liability number is a spreadsheet you're
   asked to trust.

## The idea

Split the equation `reserve ≥ liabilities` by what each side needs:

| Side | Property needed | How Solvent does it |
|------|-----------------|---------------------|
| **Reserve** | public, tamper-proof, no oracle | Read a **real on-chain token balance** on Stellar (native XLM / USDC Stellar Asset Contract) directly from the contract. |
| **Liabilities** | private, yet provably honest | A **Groth16 zero-knowledge proof** that a hidden customer ledger sums to a public `total`, with every balance range-checked. |

The contract verifies the proof, reads the live reserve, and records whether
`reserve ≥ total` — **without ever seeing an individual customer balance.**

### Why the ZK is load-bearing (not decoration)

The public `total` is *cryptographically bound* to the proof. The circuit
enforces:

- **Sum:** `total = Σ balances[i]` — the published liability equals the real sum.
- **Range:** `0 ≤ balances[i] < 2⁶⁴` — no negative balances to secretly cancel
  out a debt, no field-overflow tricks to wrap the sum.

So an issuer **cannot understate liabilities**: pass a smaller `total` and the
on-chain verifier rejects the proof. We demonstrate exactly this on live
testnet — the fraudulent attestation fails with `InvalidProof`
([details](deploy/DEPLOYMENT.md)). Remove the ZK and the whole solvency claim
becomes an unverifiable assertion again.

### Why it touches Stellar (not just "a chain")

- The proof is verified with Stellar's **native BLS12-381 host functions**
  (`env.crypto().bls12_381()`, CAP-0059, Protocol 22+) — the pairing check runs
  *in-contract*, cheaply, no verifier bloat.
- The reserve is a live **Stellar Asset Contract** balance read via a
  cross-contract `TokenClient::balance()` call — the "no oracle" property comes
  straight from Stellar's asset model.

---

## How it works

```
   PRIVATE (off-chain)                         PUBLIC (on-chain, Stellar)
 ┌───────────────────────┐
 │ customer ledger        │   Groth16 proof
 │ balances[8] (private)  │──────────────┐
 └───────────────────────┘   +           │
   circuits/solvency.circom   total       ▼
   • Σ balances = total       (public)  ┌───────────────────────────────────┐
   • 0 ≤ balances[i] < 2^64             │  Solvent Soroban contract          │
                                        │                                     │
                                        │  attest(proof, total):              │
                                        │   1. verify Groth16 (BLS12-381)     │
                                        │      pairing check — binds `total`  │
                                        │   2. reserve = Token.balance(holder)│──▶ real XLM/USDC
                                        │   3. record solvent = reserve≥total │    (Stellar Asset
                                        │   4. emit Attested event            │     Contract)
                                        └───────────────────────────────────┘
```

The verifier implements the standard Groth16 equation using Stellar's host
crypto:

```
e(-A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1
      where  vk_x = IC[0] + Σ pub_signals[i] · IC[i+1]
```

---

## Live on testnet

| | |
|---|---|
| Contract | [`CDCO5ERG…MMWSRFOV`](https://stellar.expert/explorer/testnet/contract/CDCO5ERGD2HHRJCEBJ4M4D7F52UEJNVZV3J7DXOBIU35UIGCMMWSRFOV) |
| Honest attestation | `reserve = 99,940,447,803` stroops ≥ `total = 35,000,000,000` → **solvent: true** |
| Fraud attempt | understated total → **`InvalidProof`** (rejected on-chain) |

Full addresses, tx hashes and raw output: [`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md).

---

## Repository layout

```
circuits/
  solvency.circom       ZK circuit: sum + range-check over a private ledger
  input.json            sample private customer ledger (8 balances)
  build/                proof.json, public.json, verification_key.json (+ onchain/*.hex)
scripts/
  gen_proof.sh          off-chain proving pipeline (circom + snarkjs, BLS12-381)
tools/convert/          snarkjs JSON  ->  packed arkworks bytes for Soroban
contracts/solvent/
  src/lib.rs            the Soroban contract: init / attest / status / config
  src/test.rs           3 tests against the REAL generated proof
deploy/
  deploy_testnet.sh     one-command deploy + on-chain SOLVENT & fraud demo
  DEPLOYMENT.md         addresses, tx hashes, and captured output
```

---

## Reproduce it end-to-end

**Prerequisites:** `circom` 2.x, `snarkjs`, Rust + `wasm32v1-none` target, and the
[`stellar` CLI](https://developers.stellar.org/docs/tools/cli) (≥ 22).

```bash
# 1. Generate the ZK proof from the private ledger (BLS12-381 Groth16)
scripts/gen_proof.sh

# 2. Pack snarkjs output into the byte blobs the contract expects
cargo run --manifest-path tools/convert/Cargo.toml -- circuits/build

# 3. Verify the on-chain verifier against the real proof (3 scenarios)
cargo test --manifest-path contracts/solvent/Cargo.toml

# 4. Build the contract wasm
stellar contract build --manifest-path contracts/solvent/Cargo.toml

# 5. Deploy to testnet and run the live SOLVENT + fraud demo
deploy/deploy_testnet.sh
```

The three tests in step 3 encode the whole story:

| Test | Asserts |
|------|---------|
| `solvent_when_reserve_covers_liabilities` | valid proof + reserve ≥ total ⇒ `solvent = true` |
| `insolvent_is_detected_but_proof_still_valid` | *honest* proof, reserve < total ⇒ `solvent = false` (issuer can't hide insolvency) |
| `cannot_understate_liabilities` | understated `total` ⇒ `InvalidProof` (issuer can't lie) |

---

## Honest scope & roadmap

This is a hackathon **proof-of-concept**, deliberately small where it doesn't
change the core claim. What's real vs. what's next:

**Real today**
- End-to-end ZK: circuit → proof → **on-chain BLS12-381 verification** on Stellar.
- Reserve as a genuine on-chain token balance (no oracle).
- Fraud (understated liabilities) provably rejected on live testnet.

**Known limitations**
- **Fixed ledger size `N = 8`.** The circuit hard-codes 8 balances so the setup
  is fast to demo. Production needs a **Merkle-sum-tree** so the proof size /
  setup are independent of customer count (scales to millions).
- **No per-customer inclusion proof yet.** A customer can't *yet* independently
  verify their balance is in the attested `total`. The Merkle-sum-tree design
  gives each customer a private inclusion proof — the missing half of a complete
  PoR/PoL system.
- **Sample ledger is mock data** in `circuits/input.json`; a real issuer would
  feed its actual (private) liability set.
- **Trusted setup is a single local contribution** (fine for a PoC); production
  would use a proper multi-party ceremony.
- Not audited.

**Roadmap**
1. Merkle-sum-tree liabilities + per-customer inclusion proofs.
2. Multiple reserve tokens / multi-asset solvency in one attestation.
3. Optional auditor "view key" for regulator-grade selective disclosure.
4. Scheduled/continuous attestations with historical on-chain record.

---

## Tech

Circom 2 · snarkjs · Groth16 · **BLS12-381** · arkworks · Soroban
(`soroban-sdk` 25) · Stellar Asset Contract · Stellar CLI.

*Not audited. For the Stellar "Real-World ZK" hackathon.*
