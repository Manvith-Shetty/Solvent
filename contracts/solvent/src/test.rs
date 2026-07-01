#![cfg(test)]
extern crate std;

use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Bytes, Env};
use std::{fs, path::PathBuf, string::String};

use crate::{Error, Solvent, SolventClient};

// Load the real artifacts produced by scripts/gen_proof.sh + tools/convert.
fn artifact(name: &str) -> String {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../circuits/build/onchain")
        .join(name);
    fs::read_to_string(&p).unwrap_or_else(|e| {
        panic!(
            "missing {} ({e}). Run scripts/gen_proof.sh then \
             `cargo run --manifest-path tools/convert/Cargo.toml` first.",
            p.display()
        )
    })
}

fn bytes_hex(env: &Env, name: &str) -> Bytes {
    let raw = hex::decode(artifact(name).trim()).expect("valid hex");
    Bytes::from_slice(env, &raw)
}

fn total() -> i128 {
    artifact("total.txt").trim().parse().expect("total i128")
}

/// Deploy Solvent with a reserve token holding `reserve` stroops.
fn deploy<'a>(env: &'a Env, reserve: i128) -> SolventClient<'a> {
    let issuer = Address::generate(env);
    let sac_admin = Address::generate(env);
    let sac = env.register_stellar_asset_contract_v2(sac_admin);
    let token = sac.address();
    let holder = Address::generate(env);
    StellarAssetClient::new(env, &token).mint(&holder, &reserve);

    let id = env.register(Solvent, ());
    let client = SolventClient::new(env, &id);
    client.init(&issuer, &token, &holder, &bytes_hex(env, "vk_bytes.hex"));
    client
}

#[test]
fn solvent_when_reserve_covers_liabilities() {
    let env = Env::default();
    env.mock_all_auths();

    let total = total();
    let reserve = total + 5_000_000_000; // 500 XLM surplus
    let client = deploy(&env, reserve);

    let att = client.attest(&bytes_hex(&env, "proof_bytes.hex"), &total);

    assert_eq!(att.total_liabilities, total);
    assert_eq!(att.reserve, reserve);
    assert!(att.solvent, "reserve exceeds liabilities => solvent");
    assert_eq!(att.seq, 1);
    assert_eq!(client.status(), Some(att));
}

#[test]
fn insolvent_is_detected_but_proof_still_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let total = total();
    let reserve = total - 5_000_000_000; // undercollateralized
    let client = deploy(&env, reserve);

    // The proof is valid (liabilities are honestly reported); the contract
    // simply finds the on-chain reserve insufficient.
    let att = client.attest(&bytes_hex(&env, "proof_bytes.hex"), &total);
    assert_eq!(att.reserve, reserve);
    assert!(!att.solvent, "reserve below liabilities => insolvent");
}

#[test]
fn cannot_understate_liabilities() {
    let env = Env::default();
    env.mock_all_auths();

    let total = total();
    let client = deploy(&env, total + 5_000_000_000);

    // Issuer tries to claim a smaller `total` than the ledger really sums to.
    // The proof is bound to the true total, so verification fails.
    let understated = total - 1;
    let r = client.try_attest(&bytes_hex(&env, "proof_bytes.hex"), &understated);
    assert_eq!(r, Err(Ok(Error::InvalidProof)));

    // No attestation was recorded.
    assert_eq!(client.status(), None);
}
