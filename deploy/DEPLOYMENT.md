# Live testnet deployment

Reproduced any time with `deploy/deploy_testnet.sh`. The addresses below are
from the reference run used in the demo video.

| What                           | Value                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| Network                        | Stellar **testnet** (`Test SDF Network ; September 2015`)          |
| Solvent contract               | `CBNMJDIEVKLVP2N6XVUCWDQATOXUVQ743C6W3BYYJMIMNFPBRWWGNLJG`         |
| Issuer account                 | `GDDSIZGEJ22PMJRANONGUFXSZM744RGJBMETCHFLSEJTMZ6A6E226YC7`         |
| Reserve token (native XLM SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`         |
| Contract wasm hash             | `0c0db365830710f09c51be385f17bab16817332ce5eda7462454d4e51dc6ea5e` |

## Transactions

| Step               | Tx hash                                                            |
| ------------------ | ------------------------------------------------------------------ |
| Upload WASM        | `1481d19dd031f12569c4c6f78c532f6851a726d1e37bafa8fea726aa6bd441c6` |
| Deploy             | `69ea80a71bf9f960155e9e4e2e9176b564c2557fa24a314d890038cb28861b8a` |
| `init`             | `13b1c12cbe11e4e67f95b6184c7759315f0c671b24ac4356c5b674f2a01a0221` |
| `attest` (SOLVENT) | `5da0d117a12be1490232f001697fae73860b8c6c2b7b83ab0cc62180d1de6649` |

Explorer: <https://stellar.expert/explorer/testnet/contract/CBNMJDIEVKLVP2N6XVUCWDQATOXUVQ743C6W3BYYJMIMNFPBRWWGNLJG>

## Result of the honest attestation

```json
{
  "ledger": 3392908,
  "reserve": "99944472388",
  "seq": 1,
  "solvent": true,
  "timestamp": 1782979378,
  "total_liabilities": "35000000000"
}
```

Event emitted:

```
Event: Attested (attested),
  issuer: "GDDSIZGEJ22PMJRANONGUFXSZM744RGJBMETCHFLSEJTMZ6A6E226YC7",
  total_liabilities: "35000000000",
  reserve: "99944472388",
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
