# Batch payouts from a CSV

Up to 100 payouts in one request, each retry-safe. A **dry run by default**: it previews every payout's network fee and what your workspace's policies will do (send straight away, wait for approvals, or block), and sends nothing until you add `--send`.

```bash
npm install
cp .env.example .env       # key file and the operational wallet that pays
npm start                  # dry run with payouts.csv
npm start -- --send        # send
```

`payouts.csv`: replace the placeholders with your own testnet addresses first.

```csv
id,asset,amount,to
payout_1001,USDT-TRC20,12.50,YOUR_TEST_TRON_ADDRESS_1
```

**What to notice**

- `id` becomes `externalId`. Running the same file again returns the payouts already created: nobody is paid twice.
- `transfers.preview` creates nothing. Use it to show a fee before your customer confirms a withdrawal.
- A batch isn't all-or-nothing: each payout is created or refused on its own, and the result says which.
- Payouts above your policy thresholds wait for approvers, who approve with passkeys in the dashboard.

Docs: [Batch payouts](https://valtu.io/docs/api#batch-transfers) · [Retry-safe payouts](https://valtu.io/blog/retry-safe-payouts-with-externalid)
