# Live testnet deployment

Reproduced any time with `deploy/deploy_testnet.sh`. The addresses below are
from the reference run used in the demo video.

| What | Value |
|------|-------|
| Network | Stellar **testnet** (`Test SDF Network ; September 2015`) |
| Solvent contract | `CDCO5ERGD2HHRJCEBJ4M4D7F52UEJNVZV3J7DXOBIU35UIGCMMWSRFOV` |
| Issuer account | `GADTGSN6ZXBV7STRBKYLZUI3M7PIMHB27LNZHZALSMC7RX2JNQ4X7QCY` |
| Reserve token (native XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Contract wasm hash | `a0f719ed7d7ae9aac2da3ea347c81770467bb6900ff2e3631fd59c8f1919f32b` |

## Transactions

| Step | Tx hash |
|------|---------|
| Deploy | `f9ef978314d2031bad0813c590c75def6a68b1302504587f8f7450dc033a4ba3` |
| `init` | `0a3f184e94d93ba8014864ae92ba731207ce36dd76e04772cc247213e909a2fc` |
| `attest` (SOLVENT) | `ebfa0ff516a5262d73152386df601c1cfd312006faf9850ac3408392974d288a` |

Explorer: <https://stellar.expert/explorer/testnet/contract/CDCO5ERGD2HHRJCEBJ4M4D7F52UEJNVZV3J7DXOBIU35UIGCMMWSRFOV>

## Result of the honest attestation

```json
{
  "ledger": 3385011,
  "reserve": "99940447803",
  "seq": 1,
  "solvent": true,
  "timestamp": 1782939833,
  "total_liabilities": "35000000000"
}
```

Event emitted:

```
Event: Attested (attested),
  issuer: "GADTGSN6ZXBV7STRBKYLZUI3M7PIMHB27LNZHZALSMC7RX2JNQ4X7QCY",
  total_liabilities: "35000000000",
  reserve: "99940447803",
  solvent: true
```

## Result of the fraudulent attestation

Attesting an **understated** total (`total - 1`, unmatched by the proof) is
rejected by the on-chain verifier:

```
error: transaction simulation failed: HostError: Error(Contract, #3)
```

`Error #3` is `InvalidProof` — the ZK proof is cryptographically bound to the
true total, so the issuer cannot lie about what it owes. This is the proof that
the zero-knowledge layer is load-bearing.
