// Send payouts from a CSV in one batch. Dry run by default: it previews each payout's network fee
// and what your policies will do, and sends nothing. Add --send to send. Every payout carries your
// own id as externalId, so running it again after a timeout never pays anyone twice.
import { readFile } from "node:fs/promises";
import { Valtu } from "@valtu/wallet-kit";

const valtu = Valtu.fromEnv(); // VALTU_PRIVATE_KEY or VALTU_KEY_FILE
const walletId = process.env.PAYOUT_WALLET_ID;
if (!walletId) throw new Error("set PAYOUT_WALLET_ID (the operational wallet that pays)");
const send = process.argv.includes("--send");
const file = process.argv.find((a) => a.endsWith(".csv")) ?? "payouts.csv";

const [header, ...lines] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
const cols = header.split(",").map((c) => c.trim());
const rows = lines.filter(Boolean).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v.trim()])));
if (rows.length > 100) throw new Error("a batch holds at most 100 payouts: split the file");

const payouts = await Promise.all(rows.map(async (r) => ({
  walletId, asset: r.asset, to: r.to, externalId: r.id, category: "payroll",
  amount: await valtu.assets.toBaseUnits(r.asset, r.amount), // "12.50" → base units for that asset
  display: `${r.amount} ${r.asset} → ${r.to}`,
})));

// What would happen: fee, whether the wallet can pay it, and the policy outcome.
let blocked = 0;
for (const p of payouts) {
  const { display, ...input } = p;
  const v = await valtu.transfers.preview(input);
  const fee = v.fee ? `${await valtu.assets.fromBaseUnits(v.fee.asset, v.fee.fee)} ${v.fee.symbol}${v.fee.ok ? "" : ` (${v.fee.code})`}` : "n/a";
  const outcome = v.outcome === "ALLOW" ? "sent straight to signing" : v.outcome === "DENY" ? `BLOCKED: ${v.reason}` : `needs ${v.approvals} approval(s)${v.groupName ? ` from ${v.groupName}` : ""}`;
  if (v.outcome === "DENY" || (v.fee && !v.fee.ok)) blocked++;
  console.log(`${p.externalId}  ${display}  fee ${fee}  ${outcome}`);
}

if (!send) {
  console.log(`\nDry run: nothing sent.${blocked ? ` ${blocked} payout(s) would fail.` : ""} Run again with --send to send.`);
  process.exit(0);
}

// One request, up to 100 payouts. Not all-or-nothing: each one is created or refused on its own.
const result = await valtu.transfers.createBatch(payouts.map(({ display, ...p }) => p));
for (const r of result.results) {
  console.log(r.ok ? `${r.externalId}  created, status ${r.transfer.status}` : `${r.externalId ?? `#${r.index}`}  refused: ${r.error.code} ${r.error.message}`);
}
console.log(`\n${result.created} created, ${result.failed} refused. Statuses change by webhook (transfer.*), or check with transfers.get(id).`);
