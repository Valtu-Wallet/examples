// A deposit address per customer, and a balance credited exactly once when a deposit is final.
// The pattern for exchanges, brokers and wallets: one Valtu wallet per customer (keyed by your
// customer id), credit on `deposit.confirmed` keyed by the deposit id, and reconcile on start.
import http from "node:http";
import { Valtu, constructEvent, depositAddress, EventDeduper, WebhookVerificationError } from "@valtu/wallet-kit";

const valtu = Valtu.fromEnv(); // VALTU_PRIVATE_KEY or VALTU_KEY_FILE
const WEBHOOK_KEY = process.env.VALTU_WEBHOOK_PUBLIC_KEY;
const seen = new EventDeduper();

// Your ledger. In production: a table with a UNIQUE constraint on deposit_id.
const credited = new Map(); // depositId → { customerId, asset, amount }
const balances = new Map(); // `${customerId}:${asset}` → bigint (base units)

/** Credit a final deposit once, whatever path it arrives by (webhook or reconciliation). */
async function credit(depositId) {
  if (credited.has(depositId)) return false;
  const d = await valtu.deposits.get(depositId); // the record, not the notification
  if (d.status !== "CONFIRMED" || !d.walletExternalId) return false; // only final deposits, only customer wallets
  credited.set(depositId, { customerId: d.walletExternalId, asset: d.asset, amount: d.amount });
  const key = `${d.walletExternalId}:${d.asset}`;
  balances.set(key, (balances.get(key) ?? 0n) + BigInt(d.amount));
  console.log(`credited ${await valtu.assets.fromBaseUnits(d.asset, d.amount)} ${d.asset} to ${d.walletExternalId}`);
  return true;
}

/** On start (and, in production, on a schedule): catch up on anything a webhook missed. */
async function reconcile(sinceIso) {
  let n = 0;
  for await (const d of valtu.deposits.iterate({ status: "CONFIRMED", after: sinceIso })) if (await credit(d.id)) n++;
  console.log(`reconciled: ${n} deposit(s) credited`);
}

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body, null, 2)); };
const readBody = (req) => new Promise((ok, fail) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); req.on("error", fail); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    // GET /customers/cus_42/address?network=tron → the customer's deposit address on that network.
    const m = /^\/customers\/([\w-]{1,64})\/address$/.exec(url.pathname);
    if (req.method === "GET" && m) {
      const wallet = await valtu.wallets.forCustomer(m[1]); // creates it the first time, then returns the same one
      const network = url.searchParams.get("network") ?? "tron";
      const address = depositAddress(wallet, network);
      if (!address) return json(res, 400, { error: `no ${network} address on this wallet` });
      return json(res, 200, { customer: m[1], network, address });
    }

    // GET /customers/cus_42/balance → what your ledger credited.
    const b = /^\/customers\/([\w-]{1,64})\/balance$/.exec(url.pathname);
    if (req.method === "GET" && b) {
      const rows = [...balances].filter(([k]) => k.startsWith(`${b[1]}:`));
      return json(res, 200, Object.fromEntries(await Promise.all(rows.map(async ([k, v]) => [k.split(":")[1], await valtu.assets.fromBaseUnits(k.split(":")[1], v)]))));
    }

    if (req.method === "POST" && url.pathname === "/webhooks") {
      const raw = await readBody(req);
      let event;
      try {
        event = constructEvent(raw, req.headers, { publicKey: WEBHOOK_KEY });
      } catch (e) {
        if (e instanceof WebhookVerificationError) return json(res, 400, { error: "bad signature" });
        throw e;
      }
      if (seen.first(event.id)) {
        if (event.type === "deposit.pending") console.log(`deposit seen: ${event.data.amount} ${event.data.asset} (not final yet)`);
        if (event.type === "deposit.confirmed") await credit(event.data.depositId);
        if (event.type === "deposit.orphaned") console.log(`deposit ${event.data.depositId} dropped by a reorganization: never credit it`);
      }
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: "internal error" });
  }
}).listen(Number(process.env.PORT ?? 3000), async () => {
  console.log("Listening on http://localhost:" + (process.env.PORT ?? 3000));
  await reconcile(new Date(Date.now() - 7 * 86_400_000).toISOString()).catch((e) => console.error("reconcile failed:", e.message));
});
