#!/usr/bin/env bash
#
# Solvent — Insolvent demo on Stellar testnet
# ============================================
# Deploys a contract where the reserve is deliberately too small,
# proving that the contract correctly detects INSOLVENCY.
#
# Usage: deploy/deploy_insolvent.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NET=testnet
ONCHAIN="$ROOT/circuits/build/onchain"
WASM="$ROOT/contracts/solvent/target/wasm32v1-none/release/solvent.wasm"

VK_HEX="$(tr -d '[:space:]' < "$ONCHAIN/vk_bytes.hex")"
PROOF_HEX="$(tr -d '[:space:]' < "$ONCHAIN/proof_bytes.hex")"
TOTAL="$(tr -d '[:space:]' < "$ONCHAIN/total.txt")"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

say "1/6  Create insolvent-issuer identity"
stellar keys generate insolvent-issuer --network "$NET" --fund --overwrite
ISSUER="$(stellar keys address insolvent-issuer)"
echo "insolvent issuer: $ISSUER"

say "2/6  Create low-balance reserve-holder (only 1 XLM)"
stellar keys generate low-holder --network "$NET" --fund --overwrite
HOLDER="$(stellar keys address low-holder)"
echo "reserve holder: $HOLDER (has ~10,000 XLM from friendbot)"

# Send most of holder's XLM away, keeping only 1 XLM
stellar account pay \
  --source low-holder \
  --destination "$ISSUER" \
  --amount 9998 \
  --network "$NET" > /dev/null 2>&1 || true
echo "Transferred 9,998 XLM from holder → issuer (holder left with ~1 XLM)"

say "3/6  Ensure native-XLM SAC is deployed"
stellar contract asset deploy --asset native --network "$NET" --source insolvent-issuer 2>/dev/null || true
TOKEN="$(stellar contract id asset --asset native --network "$NET")"
echo "reserve token (native SAC): $TOKEN"

say "4/6  Deploy Solvent contract"
CONTRACT="$(stellar contract deploy --wasm "$WASM" --network "$NET" --source insolvent-issuer)"
echo "contract: $CONTRACT"

# Note: reserve_holder = low-holder (only ~1 XLM), not the issuer (~10,000 XLM)
stellar contract invoke --id "$CONTRACT" --network "$NET" --source insolvent-issuer -- \
    init --issuer "$ISSUER" --reserve_token "$TOKEN" \
         --reserve_holder "$HOLDER" --vk_bytes "$VK_HEX"

say "5/6  Check holder balance"
HOLDER_BALANCE=$(stellar account balance --source low-holder --network "$NET" 2>/dev/null || echo "unknown")
echo "Reserve holder balance: $HOLDER_BALANCE"

say "6/6  attest(honest total = $TOTAL)  -> expect INSOLVENT"
echo "Total liabilities: $TOTAL stroops ($((TOTAL / 10000000)) XLM)"
echo "Reserve holder has ~1 XLM (10,000,000 stroops)"
echo "So reserve ($HOLDER) << total ($TOTAL) => INSOLVENT"
stellar contract invoke --id "$CONTRACT" --network "$NET" --source insolvent-issuer -- \
    attest --proof_bytes "$PROOF_HEX" --total "$TOTAL"

echo
echo "=== Latest status ==="
stellar contract invoke --id "$CONTRACT" --network "$NET" --source insolvent-issuer -- status

echo "=== solvent() view ==="
stellar contract invoke --id "$CONTRACT" --network "$NET" --source insolvent-issuer -- solvent

cat <<EOF

Insolvent contract deployed on Stellar $NET:
  contract : $CONTRACT
  issuer   : $ISSUER
  reserve  : ~100 XLM
  total    : $((TOTAL / 10000000)) XLM
View it: https://stellar.expert/explorer/$NET/contract/$CONTRACT
EOF
