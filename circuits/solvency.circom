pragma circom 2.0.0;

/*
 * Solvent — Confidential Proof-of-Reserves circuit
 * -------------------------------------------------
 * The issuer holds a private ledger of what it owes each customer
 * (`balances[N]`). This circuit proves, WITHOUT revealing any individual
 * balance, that:
 *
 *   1. every balance is a real non-negative number that fits in `nBits`
 *      bits  (0 <= balances[i] < 2^nBits)  -> no hiding a debt as a
 *      "negative" balance, no field-overflow tricks, and
 *   2. all balances sum to the single PUBLIC output `total`.
 *
 * `total` is the only public signal. A Stellar contract can then compare
 * the issuer's real on-chain reserve against this proven `total` to decide
 * solvency — all while the customer ledger stays private.
 *
 * Num2Bits is inlined (identical to circomlib) so the circuit has no
 * include-path dependencies.
 */

// Enforces that `in` fits in exactly `n` bits, i.e. 0 <= in < 2^n.
template Num2Bits(n) {
    signal input in;
    signal output out[n];
    var lc1 = 0;
    var e2 = 1;
    for (var i = 0; i < n; i++) {
        out[i] <-- (in >> i) & 1;
        out[i] * (out[i] - 1) === 0; // each bit is boolean
        lc1 += out[i] * e2;
        e2 = e2 + e2;
    }
    lc1 === in; // bits recompose to the original value
}

template Solvency(N, nBits) {
    signal input balances[N]; // private: the customer ledger
    signal output total;      // public: proven sum of all balances

    component rangeCheck[N];
    var acc = 0;
    for (var i = 0; i < N; i++) {
        rangeCheck[i] = Num2Bits(nBits);
        rangeCheck[i].in <== balances[i];
        acc += balances[i];
    }

    total <== acc;
}

// 8 customer balances, each up to 2^64 (fits any realistic stablecoin amount
// in 7-decimal stroops). N is fixed at compile time for this PoC; the
// production design swaps this for a Merkle-sum-tree to scale to millions.
component main = Solvency(8, 64);
