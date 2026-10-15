// Accept a stablecoin payment with a hosted checkout: create one per order, send the customer
// to its page, and mark the order paid when the signed `checkout.completed` webhook arrives.
// No framework, no database: orders live in memory so the flow is easy to read.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { Valtu, constructEvent, EventDeduper, WebhookVerificationError } from "@valtu/wallet-kit";

const valtu = Valtu.fromEnv(); // VALTU_PRIVATE_KEY or VALTU_KEY_FILE
const PUBLIC_URL = (process.env.PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
const WEBHOOK_KEY = process.env.VALTU_WEBHOOK_PUBLIC_KEY;
const orders = new Map(); // orderId → { amount, status, checkoutUrl }
const seen = new EventDeduper(); // delivery is at least once: handle each event id once

const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font:16px/1.5 system-ui;max-width:560px;margin:64px auto;padding:0 16px}button,input{font:inherit;padding:8px 12px}</style>${body}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const readBody = (req) => new Promise((ok, fail) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); req.on("error", fail); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, PUBLIC_URL);
  try {
    // 1. A tiny shop: pick an amount.
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(page("Shop", `<h1>Pay with USDT or USDC</h1>
<form method="post" action="/orders"><input name="amount" value="25.00" size="8"> USD <button>Checkout</button></form>`));
    }

    // 2. Create the order, then a checkout for it. externalId = your order id, so retrying
    //    this request returns the same checkout instead of making a second one.
    if (req.method === "POST" && url.pathname === "/orders") {
      const amount = new URLSearchParams(await readBody(req)).get("amount") ?? "25.00";
      const orderId = randomUUID();
      const checkout = await valtu.checkouts.create({
        amount,
        externalId: orderId,
        description: `Order ${orderId.slice(0, 8)}`,
        successUrl: `${PUBLIC_URL}/orders/${orderId}`,
        cancelUrl: `${PUBLIC_URL}/`,
      });
      orders.set(orderId, { amount, status: "awaiting payment", checkoutUrl: checkout.url });
      res.writeHead(303, { location: checkout.url }); // Valtu hosts the payment page
      return res.end();
    }

    // 3. The customer comes back here. Don't trust the redirect: the webhook decides.
    if (req.method === "GET" && url.pathname.startsWith("/orders/")) {
      const order = orders.get(url.pathname.split("/")[2]);
      res.writeHead(order ? 200 : 404, { "content-type": "text/html" });
      return res.end(page("Order", order
        ? `<h1>Order: ${esc(order.status)}</h1><p>${esc(order.amount)} USD.</p><p>Refresh after the payment confirms.</p>`
        : "<h1>Order not found</h1>"));
    }

    // 4. Webhooks: verify the signature over the RAW body, de-duplicate, act on the status.
    if (req.method === "POST" && url.pathname === "/webhooks") {
      const raw = await readBody(req);
      let event;
      try {
        event = constructEvent(raw, req.headers, { publicKey: WEBHOOK_KEY });
      } catch (e) {
        if (e instanceof WebhookVerificationError) { res.writeHead(400); return res.end("bad signature"); }
        throw e;
      }
      if (seen.first(event.id) && event.type.startsWith("checkout.")) {
        const order = orders.get(event.data.externalId);
        if (order) {
          if (event.type === "checkout.completed") order.status = "paid";            // fulfil here
          else if (event.type === "checkout.underpaid") order.status = "underpaid";  // ask for the rest, or refund
          else if (event.type === "checkout.expired") order.status = "expired";
          else if (event.type === "checkout.payment_detected") order.status = "payment seen, confirming";
          console.log(`${event.type} → order ${event.data.externalId}: ${order.status}`);
        }
      }
      res.writeHead(200); // answer fast (within 10 s); do slow work after
      return res.end("ok");
    }

    res.writeHead(404);
    res.end();
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end("error");
  }
}).listen(Number(process.env.PORT ?? 3000), () => console.log(`Shop on ${PUBLIC_URL}`));
