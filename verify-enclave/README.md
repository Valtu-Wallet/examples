# Verify the enclave yourself

No account, no API key: ask Valtu's enclaves to prove which code they run, and check the answer.

```bash
npm install
npm start
```

```
host 1: verified · PCR0 matches · quorum key 3697da95fcd2aa08…
host 2: verified · PCR0 matches · quorum key 3697da95fcd2aa08…

All 2 enclave hosts run the published release.
```

`verifyAttestation` checks the certificate chain up to the hardware vendor's root, the signature, your fresh nonce and the image measurement (PCR0) against the published release. It has no dependencies, so you can read exactly what it does in [`attestation.ts`](https://github.com/Valtu-Wallet/wallet-kit/blob/main/src/attestation.ts).

Docs: [Enclave attestation](https://valtu.io/docs/security#attestation) · [Published measurements](https://valtu.io/docs/security#builds)
