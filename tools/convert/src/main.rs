//! Solvent — snarkjs → Soroban byte converter
//!
//! snarkjs emits BLS12-381 curve points as decimal-string coordinates.
//! The Soroban `bls12_381` host expects each point as arkworks
//! `serialize_uncompressed` bytes (G1 = 96, G2 = 192), which is exactly what
//! `G1Affine::from_bytes` / `G2Affine::from_bytes` decode. This tool packs the
//! verification key and proof into single concatenated blobs so the contract's
//! `init` / `attest` entrypoints (and the Stellar CLI) can take one hex arg
//! each instead of a dozen fiddly curve-point fields.
//!
//! Layout:
//!   vk_bytes    = alpha(96) | beta(192) | gamma(192) | delta(192) | IC[i](96)*
//!   proof_bytes = a(96)     | b(192)    | c(96)
//!
//! Usage: convert <build_dir>   (defaults to circuits/build)

use ark_bls12_381::{Fq, Fq2, G1Affine, G2Affine};
use ark_serialize::CanonicalSerialize;
use serde_json::Value;
use std::str::FromStr;
use std::{fs, path::PathBuf};

fn fq(s: &Value) -> Fq {
    Fq::from_str(s.as_str().expect("coord must be a string")).expect("bad Fq")
}

fn g1_bytes(v: &Value) -> Vec<u8> {
    let p = G1Affine::new(fq(&v[0]), fq(&v[1]));
    let mut buf = Vec::new();
    p.serialize_uncompressed(&mut buf).unwrap();
    assert_eq!(buf.len(), 96);
    buf
}

fn g2_bytes(v: &Value) -> Vec<u8> {
    // Fq2 element order (c0, c1) matches the reference groth16_verifier test.
    let x = Fq2::new(fq(&v[0][0]), fq(&v[0][1]));
    let y = Fq2::new(fq(&v[1][0]), fq(&v[1][1]));
    let p = G2Affine::new(x, y);
    let mut buf = Vec::new();
    p.serialize_uncompressed(&mut buf).unwrap();
    assert_eq!(buf.len(), 192);
    buf
}

fn read(dir: &PathBuf, name: &str) -> Value {
    let path = dir.join(name);
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("cannot read {}", path.display()));
    serde_json::from_str(&raw).unwrap_or_else(|_| panic!("bad JSON in {}", path.display()))
}

fn main() {
    let build_dir = PathBuf::from(
        std::env::args().nth(1).unwrap_or_else(|| "circuits/build".to_string()),
    );
    let out_dir = build_dir.join("onchain");
    fs::create_dir_all(&out_dir).unwrap();

    // ---- verification key ----
    let vk = read(&build_dir, "verification_key.json");
    let mut vk_bytes = Vec::new();
    vk_bytes.extend(g1_bytes(&vk["vk_alpha_1"]));
    vk_bytes.extend(g2_bytes(&vk["vk_beta_2"]));
    vk_bytes.extend(g2_bytes(&vk["vk_gamma_2"]));
    vk_bytes.extend(g2_bytes(&vk["vk_delta_2"]));
    let ic = vk["IC"].as_array().expect("IC array");
    for point in ic {
        vk_bytes.extend(g1_bytes(point));
    }
    let n_public = vk["nPublic"].as_u64().unwrap_or((ic.len() as u64) - 1);

    // ---- proof ----
    let proof = read(&build_dir, "proof.json");
    let mut proof_bytes = Vec::new();
    proof_bytes.extend(g1_bytes(&proof["pi_a"]));
    proof_bytes.extend(g2_bytes(&proof["pi_b"]));
    proof_bytes.extend(g1_bytes(&proof["pi_c"]));

    // ---- public signal (total) ----
    let public = read(&build_dir, "public.json");
    let total = public[0].as_str().expect("public[0]").to_string();

    let vk_hex = hex::encode(&vk_bytes);
    let proof_hex = hex::encode(&proof_bytes);
    fs::write(out_dir.join("vk_bytes.hex"), &vk_hex).unwrap();
    fs::write(out_dir.join("proof_bytes.hex"), &proof_hex).unwrap();
    fs::write(out_dir.join("total.txt"), &total).unwrap();

    eprintln!("nPublic          : {n_public}");
    eprintln!("IC points        : {}", ic.len());
    eprintln!("vk_bytes         : {} bytes  -> onchain/vk_bytes.hex", vk_bytes.len());
    eprintln!("proof_bytes      : {} bytes  -> onchain/proof_bytes.hex", proof_bytes.len());
    eprintln!("total (public)   : {total}  -> onchain/total.txt");
}
