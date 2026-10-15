# Customer deposit addresses

One Valtu wallet per customer, a deposit address on any network, and a balance credited **exactly once** when a deposit is final. The pattern for exchanges, brokers and consumer wallets.

```bash
npm install
cp .env.example .env
npm start
curl http://localhost:3000/customers/cus_42/address?network=tron
```

Send test USDT to that address from a testnet faucet, then watch the deposit go `pending → confirmed` and the balance appear:

```bash
npx valtu-wallet-kit webhooks listen --forward http://localhost:3000/webhooks
curl http://localhost:3000/customers/cus_42/balance
```

**What to notice**

- `wallets.forCustomer("cus_42")` is safe to call every time: it returns the same wallet.
- Credit only on `deposit.confirmed`, keyed by the deposit id (in production, a unique constraint).
- `deposit.orphaned` means a chain reorganization dropped it before it was final: never credit it.
- On start, `deposits.iterate({ status: "CONFIRMED", after })` catches up on anything a webhook missed.

Docs: [Deposits](https://valtu.io/docs/api#deposits) · [When is a deposit final?](https://valtu.io/blog/when-is-a-deposit-final)
