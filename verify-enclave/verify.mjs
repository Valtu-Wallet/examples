// Check, without an account or API key, that Valtu's enclaves run the published release.
// Each host returns a document signed by the hardware vendor, containing the image measurement
// (PCR0), your random nonce (so it was made just now), and the public keys the enclave holds.
import { randomBytes } from "node:crypto";
import { verifyAttestation } from "@valtu/wallet-kit";

// The production release's PCR0, from https://valtu.io/docs/security#builds. Pass another as an argument.
const PCR0 = process.argv[2] ?? "2f05574996f4a721ac86766860287a842f7424c41a1d80795bbbb0226a32d624ca0b64b665b89473eb5eacfefb7196d1";
const BASE = process.env.VALTU_BASE_URL ?? "https://valtu.io";

const nonce = randomBytes(32).toString("hex");
const res = await fetch(`${BASE}/v1/attestation?nonce=${nonce}`);
if (!res.ok) throw new Error(`attestation request failed: ${res.status}`);
const { attestations } = await res.json();

let ok = 0;
for (const [i, a] of attestations.entries()) {
  try {
    const v = verifyAttestation(a.document, { nonce, expectedPcr0: PCR0 }); // throws if anything doesn't hold
    const keys = v.statement?.keys ?? {};
    console.log(`host ${i + 1}: verified · PCR0 matches · quorum key ${String(keys.quorum ?? "").slice(0, 16)}…`);
    ok++;
  } catch (e) {
    console.log(`host ${i + 1}: FAILED · ${e.message}`);
  }
}
console.log(ok === attestations.length && ok > 0
  ? `\nAll ${ok} enclave hosts run the published release. Compare the keys with https://valtu.io/docs/security#keys.`
  : `\n${attestations.length - ok} of ${attestations.length} host(s) failed verification.`);
process.exit(ok === attestations.length && ok > 0 ? 0 : 1);
