# Accept USDT with a hosted checkout

A shop page, a checkout per order, and an order marked **paid** when the signed `checkout.completed` webhook arrives. One file, no framework.

```bash
npm install
cp .env.example .env        # add your test workspace's key file and webhook public key
npm start                   # http://localhost:3000
```

**Webhooks on your machine:** in a second terminal, forward your workspace's events to the app (no public URL needed):

```bash
npx valtu-wallet-kit webhooks listen --forward http://localhost:3000/webhooks
```

It prints a webhook public key for the session: put it in `VALTU_WEBHOOK_PUBLIC_KEY`.

**What to notice**

- `externalId` is your order id: retrying `checkouts.create` returns the same checkout.
- The return page doesn't mark anything paid. Only a verified webhook does.
- Events are de-duplicated by `event.id` (delivery is at least once) and handled by status, not arrival order.

Docs: [Checkouts](https://valtu.io/docs/api#checkouts) · [Webhooks](https://valtu.io/docs/api#webhooks)
