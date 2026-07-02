#![no_std]
//! Solvent — Confidential Proof-of-Reserves on Stellar
//! ====================================================
//!
//! An issuer (stablecoin, exchange, custodian, RWA platform) proves it is
//! solvent — that its real on-chain reserve covers everything it owes
//! customers — WITHOUT publishing the individual customer balances.
//!
//! How it works:
//!   * Off-chain, the issuer generates a Groth16 proof (BLS12-381) that its
//!     private customer ledger sums to a single public `total`, with every
//!     balance range-checked to be non-negative (see `circuits/solvency.circom`).
//!   * On-chain, `attest` verifies that proof, then reads the issuer's *real*
//!     reserve as a live token balance on Stellar and records whether
//!     `reserve >= total`.
//!
//! The reserve is a genuine on-chain balance, so there is no oracle to trust:
//! anyone can independently see the reserve, while the liabilities stay private
//! but provably correct. The ZK is load-bearing — the `total` is
//! cryptographically bound to the proof, so an issuer cannot understate what it
//! owes.
//!
//! Not audited. Proof-of-concept for the Stellar "Real-World ZK" hackathon.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype,
    crypto::bls12_381::{Fr, G1Affine, G2Affine},
    token, vec, Address, Bytes, BytesN, Env, Vec, U256,
};

// Blob layout (arkworks uncompressed, big-endian points):
//   G1 = 96 bytes, G2 = 192 bytes.
//   vk    = alpha(G1) | beta(G2) | gamma(G2) | delta(G2) | IC[i](G1)*
//   proof = a(G1)     | b(G2)    | c(G1)
const G1: u32 = 96;
const G2: u32 = 192;
const VK_IC_OFFSET: u32 = G1 + G2 * 3; // 672: where the IC points begin
const PROOF_LEN: u32 = G1 + G2 + G1; // 384

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    /// The Groth16 proof failed to verify against the stored key and `total`.
    InvalidProof = 3,
    NegativeTotal = 4,
    BadProofLength = 5,
    MalformedVerifyingKey = 6,
}

#[derive(Clone)]
#[contracttype]
pub struct VerificationKey {
    pub alpha: G1Affine,
    pub beta: G2Affine,
    pub gamma: G2Affine,
    pub delta: G2Affine,
    pub ic: Vec<G1Affine>,
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: G1Affine,
    pub b: G2Affine,
    pub c: G1Affine,
}

/// A recorded solvency attestation.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Attestation {
    /// Proven total liabilities (sum of the private customer ledger), in stroops.
    pub total_liabilities: i128,
    /// Issuer's real on-chain reserve balance at attestation time, in stroops.
    pub reserve: i128,
    /// `reserve >= total_liabilities`.
    pub solvent: bool,
    /// Ledger timestamp of the attestation.
    pub timestamp: u64,
    /// Ledger sequence of the attestation.
    pub ledger: u32,
    /// Monotonic attestation counter.
    pub seq: u32,
}

/// Emitted whenever a solvency proof is verified and recorded.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attested {
    #[topic]
    pub issuer: Address,
    pub total_liabilities: i128,
    pub reserve: i128,
    pub solvent: bool,
}

const MAX_HISTORY: u32 = 20;

#[contracttype]
enum DataKey {
    Issuer,
    Token,
    Holder,
    Vk,
    Latest,
    Count,
    History,
}

#[contract]
pub struct Solvent;

#[contractimpl]
impl Solvent {
    /// One-time configuration.
    ///
    /// * `issuer`         – the only address allowed to post attestations.
    /// * `reserve_token`  – token contract whose balance backs the liabilities
    ///                      (e.g. the USDC or native-XLM Stellar Asset Contract).
    /// * `reserve_holder` – account/contract whose `reserve_token` balance is
    ///                      the reserve.
    /// * `vk_bytes`       – Groth16 verification key, packed by `tools/convert`.
    pub fn init(
        env: Env,
        issuer: Address,
        reserve_token: Address,
        reserve_holder: Address,
        vk_bytes: Bytes,
    ) -> Result<(), Error> {
        let store = env.storage().instance();
        if store.has(&DataKey::Issuer) {
            return Err(Error::AlreadyInitialized);
        }
        let vk = parse_vk(&env, &vk_bytes)?;
        store.set(&DataKey::Issuer, &issuer);
        store.set(&DataKey::Token, &reserve_token);
        store.set(&DataKey::Holder, &reserve_holder);
        store.set(&DataKey::Vk, &vk);
        store.set(&DataKey::Count, &0u32);
        store.extend_ttl(100_000, 100_000);
        Ok(())
    }

    /// Verify a solvency proof and record an attestation.
    ///
    /// `proof_bytes` is the Groth16 proof packed by `tools/convert`; `total` is
    /// the public signal it commits to (total liabilities, in stroops). The
    /// call fails with `InvalidProof` unless the proof is valid for exactly this
    /// `total` — that is what makes the number trustworthy.
    pub fn attest(env: Env, proof_bytes: Bytes, total: i128) -> Result<Attestation, Error> {
        let store = env.storage().instance();
        let issuer: Address = store.get(&DataKey::Issuer).ok_or(Error::NotInitialized)?;
        issuer.require_auth();

        if total < 0 {
            return Err(Error::NegativeTotal);
        }
        if proof_bytes.len() != PROOF_LEN {
            return Err(Error::BadProofLength);
        }

        let vk: VerificationKey = store.get(&DataKey::Vk).unwrap();
        let proof = Proof {
            a: g1_at(&proof_bytes, 0),
            b: g2_at(&proof_bytes, G1),
            c: g1_at(&proof_bytes, G1 + G2),
        };

        // Bind the proof to this exact `total`: the single public signal.
        let total_fr = Fr::from_u256(U256::from_u128(&env, total as u128));
        let pub_signals = vec![&env, total_fr];

        if !verify_groth16(&env, &vk, &proof, &pub_signals)? {
            return Err(Error::InvalidProof);
        }

        // Read the issuer's real reserve as a live on-chain token balance.
        let token_addr: Address = store.get(&DataKey::Token).unwrap();
        let holder: Address = store.get(&DataKey::Holder).unwrap();
        let reserve = token::TokenClient::new(&env, &token_addr).balance(&holder);

        let seq: u32 = store.get(&DataKey::Count).unwrap_or(0) + 1;
        let attestation = Attestation {
            total_liabilities: total,
            reserve,
            solvent: reserve >= total,
            timestamp: env.ledger().timestamp(),
            ledger: env.ledger().sequence(),
            seq,
        };
        store.set(&DataKey::Latest, &attestation);
        store.set(&DataKey::Count, &seq);

        // Store in history (keep last MAX_HISTORY)
        let mut history: Vec<Attestation> = store.get(&DataKey::History).unwrap_or(Vec::new(&env));
        history.push_back(attestation.clone());
        while history.len() > MAX_HISTORY {
            history.remove(0); // drop oldest
        }
        store.set(&DataKey::History, &history);

        store.extend_ttl(100_000, 100_000);

        Attested {
            issuer,
            total_liabilities: total,
            reserve,
            solvent: attestation.solvent,
        }
        .publish(&env);
        Ok(attestation)
    }

    /// The most recent attestation, if any.
    pub fn status(env: Env) -> Option<Attestation> {
        env.storage().instance().get(&DataKey::Latest)
    }

    /// Returns true if the latest attestation shows the issuer is solvent.
    /// Returns false if no attestation exists or the issuer is insolvent.
    pub fn solvent(env: Env) -> bool {
        env.storage()
            .instance()
            .get::<_, Attestation>(&DataKey::Latest)
            .map(|a| a.solvent)
            .unwrap_or(false)
    }

    /// All recorded attestations, newest last. Max 20 entries.
    pub fn attestations(env: Env) -> Vec<Attestation> {
        env.storage()
            .instance()
            .get(&DataKey::History)
            .unwrap_or(Vec::new(&env))
    }

    /// Configured (issuer, reserve_token, reserve_holder).
    pub fn config(env: Env) -> Result<(Address, Address, Address), Error> {
        let store = env.storage().instance();
        let issuer = store.get(&DataKey::Issuer).ok_or(Error::NotInitialized)?;
        Ok((
            issuer,
            store.get(&DataKey::Token).unwrap(),
            store.get(&DataKey::Holder).unwrap(),
        ))
    }
}

// ---- helpers -------------------------------------------------------------

fn g1_at(b: &Bytes, off: u32) -> G1Affine {
    let bn: BytesN<96> = b.slice(off..off + G1).try_into().unwrap();
    G1Affine::from_bytes(bn)
}

fn g2_at(b: &Bytes, off: u32) -> G2Affine {
    let bn: BytesN<192> = b.slice(off..off + G2).try_into().unwrap();
    G2Affine::from_bytes(bn)
}

fn parse_vk(env: &Env, b: &Bytes) -> Result<VerificationKey, Error> {
    let len = b.len();
    // Must hold alpha+beta+gamma+delta plus at least one IC point, aligned to G1.
    if len < VK_IC_OFFSET + G1 || (len - VK_IC_OFFSET) % G1 != 0 {
        return Err(Error::MalformedVerifyingKey);
    }
    let mut ic = Vec::new(env);
    let mut off = VK_IC_OFFSET;
    while off < len {
        ic.push_back(g1_at(b, off));
        off += G1;
    }
    Ok(VerificationKey {
        alpha: g1_at(b, 0),
        beta: g2_at(b, G1),
        gamma: g2_at(b, G1 + G2),
        delta: g2_at(b, G1 + G2 * 2),
        ic,
    })
}

/// Standard Groth16 check: e(-A,B)·e(alpha,beta)·e(vk_x,gamma)·e(C,delta) == 1,
/// with vk_x = ic[0] + Σ pub_signals[i]·ic[i+1].
fn verify_groth16(
    env: &Env,
    vk: &VerificationKey,
    proof: &Proof,
    pub_signals: &Vec<Fr>,
) -> Result<bool, Error> {
    if pub_signals.len() + 1 != vk.ic.len() {
        return Err(Error::MalformedVerifyingKey);
    }
    let bls = env.crypto().bls12_381();

    let mut vk_x = vk.ic.get(0).unwrap();
    for (s, v) in pub_signals.iter().zip(vk.ic.iter().skip(1)) {
        vk_x = bls.g1_add(&vk_x, &bls.g1_mul(&v, &s));
    }

    let neg_a = -proof.a.clone();
    let vp1 = vec![env, neg_a, vk.alpha.clone(), vk_x, proof.c.clone()];
    let vp2 = vec![
        env,
        proof.b.clone(),
        vk.beta.clone(),
        vk.gamma.clone(),
        vk.delta.clone(),
    ];
    Ok(bls.pairing_check(vp1, vp2))
}

mod test;
