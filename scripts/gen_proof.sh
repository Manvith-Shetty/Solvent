#!/usr/bin/env bash
#
# Solvent — off-chain proving pipeline
# ------------------------------------
# Compiles the solvency circuit for BLS12-381 and produces a Groth16 proof
# that the private ledger in circuits/input.json sums to a public `total`,
# with every balance range-checked. Output artifacts land in circuits/build/.
#
# Usage: scripts/gen_proof.sh [path/to/input.json]
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRC="$ROOT/circuits"
BUILD="$CIRC/build"
INPUT="${1:-$CIRC/input.json}"
POWER=12   # 2^12 = 4096 constraints of headroom (circuit uses ~520)

mkdir -p "$BUILD"
cd "$BUILD"

echo "== [1/6] Compile circuit for BLS12-381 =="
circom "$CIRC/solvency.circom" --r1cs --wasm -p bls12381 -o "$BUILD"
snarkjs r1cs info solvency.r1cs

echo "== [2/6] Powers of Tau (BLS12-381) =="
snarkjs powersoftau new bls12-381 "$POWER" pot_0.ptau -v > /dev/null
snarkjs powersoftau contribute pot_0.ptau pot_1.ptau \
    --name="solvent-ptau" -e="solvent hackathon $(date +%s)" > /dev/null
snarkjs powersoftau prepare phase2 pot_1.ptau pot_final.ptau -v > /dev/null

echo "== [3/6] Groth16 circuit-specific setup =="
snarkjs groth16 setup solvency.r1cs pot_final.ptau solvency_0.zkey > /dev/null
snarkjs zkey contribute solvency_0.zkey solvency_final.zkey \
    --name="solvent-zkey" -e="solvent hackathon phase2 $(date +%s)" > /dev/null
snarkjs zkey export verificationkey solvency_final.zkey verification_key.json > /dev/null

echo "== [4/6] Witness from private ledger =="
node solvency_js/generate_witness.js solvency_js/solvency.wasm "$INPUT" witness.wtns

echo "== [5/6] Generate proof =="
snarkjs groth16 prove solvency_final.zkey witness.wtns proof.json public.json

echo "== [6/6] Off-chain sanity verify =="
snarkjs groth16 verify verification_key.json public.json proof.json

echo
echo "Public signal (total, in stroops):"
cat public.json
echo
echo "Artifacts written to $BUILD :"
echo "  proof.json  public.json  verification_key.json  solvency_final.zkey"
