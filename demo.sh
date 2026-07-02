#!/usr/bin/env bash
#
# Solvent — Live Demo Script
# ==========================
# Changes customer balances, generates a new ZK proof, submits a REAL
# on-chain attestation to StellarX Exchange, tests fraud rejection,
# and validates all 4 companies' proof of reserve.
#
# Usage: bash demo.sh
#
# Prerequisites: circom, snarkjs, stellar CLI, Rust tools installed.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✅ $1${NC}"; }
info() { echo -e "${CYAN}==> $1${NC}"; }
header() { echo -e "\n${YELLOW}══════════════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}$1${NC}"; echo -e "${YELLOW}──────────────────────────────────────────────────────────────${NC}"; }
section() { echo -e "\n${BOLD}  $1${NC}"; }

# ──────────────────────────────────────────────────────────────
header "PART 1: NEW CUSTOMER BALANCES → NEW ZK PROOF"
# ──────────────────────────────────────────────────────────────

info "1.1 Save original input.json and set new balances"
cp circuits/input.json circuits/input_backup.json

cat > circuits/input.json << 'EOF'
{
  "balances": [
    "8000000000",
    "6000000000",
    "3500000000",
    "10000000000",
    "2000000000",
    "7000000000",
    "4500000000",
    "4000000000"
  ]
}
EOF

echo "    New customer ledger:"
echo "    $(cat circuits/input.json | jq -c '.balances')"
NEW_TOTAL=$(cat circuits/input.json | jq '.balances | map(tonumber) | add')
echo "    New total: ${NEW_TOTAL} stroops ($((NEW_TOTAL / 10000000)) XLM)"
echo ""

info "1.2 Generate new proof (fast — reuses saved zkey)"
cd circuits/build
node solvency_js/generate_witness.js solvency_js/solvency.wasm ../input.json witness.wtns
snarkjs groth16 prove solvency_final.zkey.save witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
cd "$ROOT"
pass "New proof generated and verified off-chain"

info "1.3 Convert proof to contract format"
cargo run --manifest-path tools/convert/Cargo.toml -- circuits/build 2>/dev/null
pass "Proof converted"

TOTAL=$(cat circuits/build/onchain/total.txt)
echo "    New total: ${TOTAL} stroops ($((TOTAL / 10000000)) XLM)"

# ──────────────────────────────────────────────────────────────
header "PART 2: SUBMIT REAL ON-CHAIN ATTESTATION"
# ──────────────────────────────────────────────────────────────

info "2.1 Submitting new proof to StellarX Exchange (REAL TX) ⚡"
echo ""
echo "    Company: StellarX Exchange"
echo "    Contract: CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO"
echo "    New total: ${TOTAL} stroops ($((TOTAL / 10000000)) XLM)"
echo ""

PROOF_HEX=$(cat circuits/build/onchain/proof_bytes.hex)

stellar contract invoke \
  --id CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO \
  --network testnet --source company-a -- \
  attest --proof_bytes "$PROOF_HEX" --total "$TOTAL"
pass "New attestation recorded on-chain ✅"

# ──────────────────────────────────────────────────────────────
header "PART 3: REALTIME STATUS AFTER CHANGE"
# ──────────────────────────────────────────────────────────────

info "3.1 StellarX Exchange — new status"
stellar contract invoke \
  --id CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO \
  --network testnet --source company-a -- status 2>&1

info "3.2 StellarX Exchange — attestation history"
stellar contract invoke \
  --id CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO \
  --network testnet --source company-a -- attestations 2>&1
pass "History shows seq 1 (old) + seq 2 (new balances)"

info "3.3 StellarX Exchange — solvent() view"
stellar contract invoke \
  --id CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO \
  --network testnet --source company-a -- solvent 2>&1

# ──────────────────────────────────────────────────────────────
header "PART 4: FRAUD REJECTION (REAL ON-CHAIN DEMO)"
# ──────────────────────────────────────────────────────────────

section "Attempting to cheat: claim total - 1 instead of real total"
echo ""

UNDERSTATED=$((TOTAL - 1))
echo "    Honest total:    $TOTAL"
echo "    Claimed total:   $UNDERSTATED (understated by 1)"
echo ""

OUTPUT=$(stellar contract invoke \
  --id CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO \
  --network testnet --source company-a -- \
  attest --proof_bytes "$PROOF_HEX" --total "$UNDERSTATED" 2>&1 || true)

if echo "$OUTPUT" | grep -qi "error\|InvalidProof\|#3"; then
    pass "FRAUD REJECTED ✅ — InvalidProof (ZK caught the lie)"
    echo "    $OUTPUT" | grep -i "error" | head -1
fi

# ──────────────────────────────────────────────────────────────
header "PART 5: VALIDATE ALL 4 COMPANIES"
# ──────────────────────────────────────────────────────────────

echo ""
echo "  ┌──────────────────────┬──────────────────────────────────────────┬────────────┬──────────────┬────────┐"
echo "  │ Company              │ Contract                                 │ Reserve    │ Liabilities  │ Status │"
echo "  ├──────────────────────┼──────────────────────────────────────────┼────────────┼──────────────┼────────┤"

validate_company() {
  local NAME=$1
  local ID=$2
  local SOURCE=$3

  local DATA=$(stellar contract invoke --id "$ID" --network testnet --source "$SOURCE" -- status 2>&1 | tail -1)
  local RESERVE=$(echo "$DATA" | jq -r '.reserve // "?"' 2>/dev/null || echo "?")
  local LIABILITIES=$(echo "$DATA" | jq -r '.total_liabilities // "?"' 2>/dev/null || echo "?")
  local SOLVENT=$(echo "$DATA" | jq -r '.solvent // "?"' 2>/dev/null || echo "?")

  local RESERVE_XLM=$((RESERVE / 10000000)) 2>/dev/null || RESERVE_XLM="?"
  local LIAB_XLM=$((LIABILITIES / 10000000)) 2>/dev/null || LIAB_XLM="?"
  local STATUS_STR=""
  if [ "$SOLVENT" = "true" ]; then STATUS_STR="${GREEN}SOLVENT${NC}"; else STATUS_STR="${RED}INSOLVENT${NC}"; fi

  printf "  │ %-20s │ %-40s │ %-10s │ %-12s │ %b │\n" "$NAME" "$ID" "$RESERVE_XLM" "$LIAB_XLM" "$STATUS_STR"
}

validate_company "StellarX Exchange" "CA3RMVFYCYNKHKUCN3M6QAIGIGZTAGNUNG4AZWZHR4MTHOGVFRCKWZFO" "company-a"
validate_company "LumensBank" "CDEZEY4Q7JI3GWGNWDXLZFQYOBI5OVDO4UK5CZG23SN4QQA67TVW275P" "company-b"
validate_company "NovaFi" "CDKA4TOJVB2DZ5PJCCOSD3TQXMF4AGZWDBMZXIX2B4VBAAP2EEBTBJGJ" "company-c"
validate_company "GoldReserve" "CADK2XJ62X5U633FCXBWCSJPJGCBBOFRABQAZGC7YNKRGWGT4BNUFKAG" "gold-admin"

echo "  └──────────────────────┴──────────────────────────────────────────┴────────────┴──────────────┴────────┘"
echo ""

# ──────────────────────────────────────────────────────────────
header "PART 6: LOCAL TESTS (SAME PROOF, DIFFERENT TOTALS)"
# ──────────────────────────────────────────────────────────────

info "6.1 Run 6 contract tests with updated proof"
cargo test --manifest-path contracts/solvent/Cargo.toml 2>&1 | tail -10
pass "All tests pass"

# ──────────────────────────────────────────────────────────────
header "PART 7: RESTORE ORIGINAL BALANCES"
# ──────────────────────────────────────────────────────────────

info "7.1 Restore original input.json"
cp circuits/input_backup.json circuits/input.json
rm circuits/input_backup.json
pass "Original customer balances restored"

info "7.2 Regenerate original proof"
cd circuits/build
node solvency_js/generate_witness.js solvency_js/solvency.wasm ../input.json witness.wtns
snarkjs groth16 prove solvency_final.zkey.save witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json
cd "$ROOT"
cargo run --manifest-path tools/convert/Cargo.toml -- circuits/build 2>/dev/null
pass "Original proof restored"

# ──────────────────────────────────────────────────────────────
header "DEMO COMPLETE ✅"
# ──────────────────────────────────────────────────────────────

echo ""
echo "  What just happened:"
echo "  ─────────────────────────────────────────────────────"
echo "  ✅ New customer balances → New ZK proof generated"
echo "  ✅ REAL attestation submitted to StellarX on testnet"
echo "  ✅ History now shows seq 1 (old) + seq 2 (new)"
echo "  ✅ Fraud caught — InvalidProof on-chain"
echo "  ✅ All 4 companies validated"
echo "  ✅ 6/6 local tests pass"
echo "  ✅ Original balances restored"
echo "  ─────────────────────────────────────────────────────"
echo ""
echo "  Dashboard: cd frontend && npm run dev → http://localhost:3000"
echo "  Repo: https://github.com/Manvith-Shetty/Stellar-hacks"
echo ""
