#!/usr/bin/env bash
#
# Solvent — deploy & demo on Stellar testnet
# ==========================================
# End-to-end, from a freshly-funded identity to a live on-chain attestation:
#
#   1. create + friendbot-fund an `issuer` identity (starts with 10,000 XLM),
#   2. make sure the native-XLM Stellar Asset Contract exists on testnet,
#   3. deploy the Solvent contract and `init` it (issuer, reserve token,
#      reserve holder = issuer, verification key),
#   4. `attest` with the honest proof            -> SOLVENT,
#   5. `attest` with an understated `total`      -> rejected (InvalidProof),
#      proving on-chain that the ZK is load-bearing.
#
# Requires: stellar CLI (>=22), and artifacts from scripts/gen_proof.sh +
# `cargo run --manifest-path tools/convert/Cargo.toml`.
#
# Usage: deploy/deploy_testnet.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NET=testnet
ONCHAIN="$ROOT/circuits/build/onchain"
WASM="$ROOT/contracts/solvent/target/wasm32v1-none/release/solvent.wasm"

VK_HEX="$(tr -d '[:space:]' < "$ONCHAIN/vk_bytes.hex")"
PROOF_HEX="$(tr -d '[:space:]' < "$ONCHAIN/proof_bytes.hex")"
TOTAL="$(tr -d '[:space:]' < "$ONCHAIN/total.txt")"

say() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

say "1/6  Create + fund issuer identity"
stellar keys generate issuer --network "$NET" --fund --overwrite
ISSUER="$(stellar keys address issuer)"
echo "issuer: $ISSUER"

say "2/6  Ensure native-XLM SAC is deployed"
# Deploy the native asset contract (idempotent: ignore 'already exists').
stellar contract asset deploy --asset native --network "$NET" --source issuer 2>/dev/null || true
TOKEN="$(stellar contract id asset --asset native --network "$NET")"
echo "reserve token (native SAC): $TOKEN"

say "3/6  Deploy Solvent contract"
CONTRACT="$(stellar contract deploy --wasm "$WASM" --network "$NET" --source issuer)"
echo "contract: $CONTRACT"

say "4/6  init(issuer, token, holder=issuer, vk_bytes)"
# Reserve holder is the issuer account itself (~10,000 XLM from friendbot).
stellar contract invoke --id "$CONTRACT" --network "$NET" --source issuer -- \
    init --issuer "$ISSUER" --reserve_token "$TOKEN" \
         --reserve_holder "$ISSUER" --vk_bytes "$VK_HEX"

say "5/6  attest(honest total = $TOTAL)  -> expect SOLVENT"
stellar contract invoke --id "$CONTRACT" --network "$NET" --source issuer -- \
    attest --proof_bytes "$PROOF_HEX" --total "$TOTAL"

say "6/6  attest(understated total)  -> expect InvalidProof (ZK is load-bearing)"
UNDERSTATED=$((TOTAL - 1))
if stellar contract invoke --id "$CONTRACT" --network "$NET" --source issuer -- \
       attest --proof_bytes "$PROOF_HEX" --total "$UNDERSTATED" 2>/tmp/solvent_fraud.err; then
    echo "!! UNEXPECTED: understated attestation succeeded"; exit 1
else
    echo "Rejected as expected:"; grep -i -m1 "InvalidProof\|Error" /tmp/solvent_fraud.err || true
fi

say "Done. Latest recorded attestation:"
stellar contract invoke --id "$CONTRACT" --network "$NET" --source issuer -- status

cat <<EOF

Contract deployed and verified on Stellar $NET:
  contract : $CONTRACT
  issuer   : $ISSUER
  token    : $TOKEN
View it: https://stellar.expert/explorer/$NET/contract/$CONTRACT
EOF
