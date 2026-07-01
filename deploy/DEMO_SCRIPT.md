# Demo video script (target: 2:30)

A tight, submission-ready walkthrough. Everything shown is real and reproducible
from this repo. Keep the terminal font large.

---

### 0:00 – 0:20 · The hook (talking head or slide)

> "Every crypto collapse — FTX, Celsius — comes down to one question asked too
> late: did they actually hold what they owed customers? Today's 'proof of
> reserves' either leaks every customer's balance, or lets the issuer quietly
> lie about how much they owe. **Solvent** fixes both — on Stellar, with zero
> knowledge."

Show the one-liner from the README:
> *reserve ≥ liabilities — reserve is a real on-chain balance, liabilities are
> proven in zero-knowledge.*

### 0:20 – 0:45 · The idea (README diagram)

Point at the ASCII diagram. Say the split:
- **Reserve** — a real on-chain token balance on Stellar. No oracle to trust.
- **Liabilities** — a Groth16 ZK proof that a *private* customer ledger sums to a
  public `total`, every balance range-checked.
- The contract checks `reserve ≥ total` **without seeing any customer balance.**

### 0:45 – 1:05 · The circuit (`circuits/solvency.circom`)

Scroll to the two constraints:
> "The circuit enforces two things: the balances **sum** to `total`, and each is
> **range-checked** non-negative — so nobody can hide a debt or overflow the
> sum. `total` is the only public output."

Run (or show pre-recorded):
```bash
scripts/gen_proof.sh
```
Point at `snarkjs groth16 verify ... OK` and the public total `35000000000`.

### 1:05 – 1:35 · On-chain verification is real (the tests)

```bash
cargo test --manifest-path contracts/solvent/Cargo.toml
```
Three green tests. Narrate each:
- `solvent…` — valid proof + enough reserve ⇒ **solvent**.
- `insolvent…` — honest proof but reserve too low ⇒ **caught**.
- `cannot_understate_liabilities` — a lie about `total` ⇒ **`InvalidProof`**.

> "That last one is the point: the ZK is load-bearing. Remove it and solvency is
> just a claim."

### 1:35 – 2:15 · Live on Stellar testnet (`deploy/deploy_testnet.sh`)

Run the script (or replay the captured log). Land on two moments:

1. **SOLVENT** — the `attest` event:
   > "The contract verified the BLS12-381 proof using Stellar's native host
   > functions, then read the issuer's **real** XLM balance — 99.9 billion
   > stroops — straight off the ledger. `solvent: true`."

2. **FRAUD REJECTED** — understated total:
   > "Now the issuer tries to understate what it owes. The proof no longer
   > matches — `Error #3, InvalidProof`. On-chain. You cannot lie to this
   > contract."

Show the stellar.expert contract link.

### 2:15 – 2:30 · Close

> "Confidential proof-of-reserves, verified on Stellar, where the ZK actually
> decides the outcome. Next: a Merkle-sum-tree for millions of customers and
> per-customer inclusion proofs. Thanks."

---

## Recording checklist
- [ ] `scripts/gen_proof.sh` output shows `OK` + public total.
- [ ] `cargo test` shows `3 passed`.
- [ ] `deploy_testnet.sh` shows the `Attested` event with `solvent: true`.
- [ ] The fraud step shows `Error(Contract, #3)`.
- [ ] End on the stellar.expert contract page.
