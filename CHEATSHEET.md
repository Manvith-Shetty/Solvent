# Solvent — Quick Test Guide

> How to change customer balances, generate new proofs, and test on Stellar testnet.

---

## 1️⃣ Edit the customer balances

```bash
# Open and change the numbers
nano circuits/input.json
```

Each number is a customer's balance in **stroops** (1 XLM = 10,000,000 stroops).

Example:

```json
{
  "balances": [
    "5000000000",
    "1000000000",
    "2500000000",
    "8000000000",
    "1500000000",
    "4500000000",
    "3500000000",
    "3000000000"
  ]
}
```

(Total = 29,000,000,000 stroops)

---

## 2️⃣ Re-prove (fast — skips trusted setup)

```bash
cd circuits/build
node solvency_js/generate_witness.js solvency_js/solvency.wasm ../input.json witness.wtns
snarkjs groth16 prove solvency_final.zkey.save witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
```

---

## 3️⃣ Convert to contract format

```bash
cargo run --manifest-path ../../tools/convert/Cargo.toml -- .
```

---

## 4️⃣ Run local tests

```bash
cargo test --manifest-path ../../contracts/solvent/Cargo.toml
```

---

## 5️⃣ Submit to existing testnet contract

```bash
TOTAL=$(cat onchain/total.txt)
PROOF_HEX=$(cat onchain/proof_bytes.hex)

stellar contract invoke \
  --id CBNMJDIEVKLVP2N6XVUCWDQATOXUVQ743C6W3BYYJMIMNFPBRWWGNLJG \
  --network testnet --source issuer -- \
  attest --proof_bytes "$PROOF_HEX" --total "$TOTAL"
```

---

## 6️⃣ (Optional) Test fraud rejection

```bash
UNDERSTATED=$((TOTAL - 1))
stellar contract invoke \
  --id CBNMJDIEVKLVP2N6XVUCWDQATOXUVQ743C6W3BYYJMIMNFPBRWWGNLJG \
  --network testnet --source issuer -- \
  attest --proof_bytes "$PROOF_HEX" --total "$UNDERSTATED"
```

---

**Steps 1–4** are local. **Steps 5–6** are on testnet.
