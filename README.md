# Valtu examples

Small, runnable apps built on [`@valtu/wallet-kit`](https://www.npmjs.com/package/@valtu/wallet-kit). Each one is a single file with no framework, so the Valtu parts are easy to see and copy.

| Example | What it shows |
| --- | --- |
| [**accept-usdt-checkout**](./accept-usdt-checkout) | Take a stablecoin payment with a hosted checkout, and mark the order paid from a verified webhook |
| [**customer-deposits**](./customer-deposits) | A deposit address per customer, and balances credited exactly once when deposits are final |
| [**batch-payouts**](./batch-payouts) | Up to 100 payouts from a CSV: preview fees and policies, then send, retry-safe |
| [**verify-enclave**](./verify-enclave) | Check, with no account, that Valtu's enclaves run the published release |

## Before you start

1. **A test workspace** (free, on testnets): [valtu.io/app/signup](https://valtu.io/app/signup).
2. **An API key:** Dashboard → Developers → API keys → Create key. Save the key file next to the example as `valtu-server.json` (git ignores it), or set `VALTU_PRIVATE_KEY`.
3. **Node.js 20.6 or newer** (18.17 for `verify-enclave`).

Then, in an example's folder:

```bash
npm install
cp .env.example .env
npm start
```

**Webhooks without a public URL:** `npx valtu-wallet-kit webhooks listen --forward http://localhost:3000/webhooks` forwards your workspace's events to your machine, signed, and prints the public key to verify them with.

## Learn more

[Integration guide](https://valtu.io/docs/integration) · [API guide](https://valtu.io/docs/api) · [Wallet kit](https://valtu.io/docs/wallet-kit) · [Security](https://valtu.io/security) · [Talk to us](https://valtu.io/contact)

MIT licensed. Never commit API keys: `.env` and `valtu-*.json` are git-ignored.
