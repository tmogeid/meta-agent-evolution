import { ingestBatch } from "../src/evidence.mjs";
import { detectRecurrentFailures } from "../src/patterns.mjs";
import { buildProposals } from "../src/proposals.mjs";
import { createMetaAdapter } from "../src/meta-adapter.mjs";

const batch = ingestBatch([
  {
    source: "synthetic-fixture",
    harness: "node-test",
    session: "session-a",
    date: "2026-10-20T00:00:00Z",
    type: "test",
    result: { status: "failure", code: "E_TIMEOUT", type: "network", operation: "worker" },
  },
  {
    source: "synthetic-fixture",
    harness: "node-test",
    session: "session-b",
    date: "2026-10-21T00:00:00Z",
    type: "test",
    result: { status: "failure", code: "E_TIMEOUT", type: "network", operation: "worker" },
  },
]);

if (batch.rejected.length > 0) throw new Error("Synthetic evidence was rejected.");
const patterns = detectRecurrentFailures(batch.accepted);
const [proposal] = buildProposals(patterns, { targetKind: "prompt" });
if (!proposal) throw new Error("No recurrent synthetic pattern was detected.");

const evidenceIds = proposal.evidenceRefs.map(({ acceptedIndex }) => `evidence-${acceptedIndex}`);
const enrichedProposal = {
  ...proposal,
  evidenceRefs: proposal.evidenceRefs.map(({ acceptedIndex }) => {
    const accepted = batch.accepted[acceptedIndex];
    return {
      acceptedIndex,
      session: accepted.session,
      harness: accepted.harness,
      date: accepted.date,
      occurrences: accepted.occurrences,
    };
  }),
};
const simulatedRecommendation = {
  id: "rec-timeout-retry",
  target: { kind: "prompt", name: "worker-retry-guidance" },
  problem: "Repeated worker timeout failures appear in the synthetic evidence.",
  improvement: "Clarify when bounded retry guidance should be considered.",
  rationale: "The same failure code appears across multiple sessions.",
  evidenceIds,
  uncertainty: "Synthetic data does not establish the underlying cause.",
  limitations: "No production evidence or behavioral evaluation was used.",
};

const offlineFetch = async () => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(simulatedRecommendation) } }],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      })));
      controller.close();
    },
  }),
});

const adapter = createMetaAdapter({
  enabled: true,
  offline: true,
  fetch: offlineFetch,
});
const result = await adapter.enrichProposal(enrichedProposal, {
  evidenceIds,
  evidenceRecords: batch.accepted,
});

console.log(JSON.stringify({
  originalProposal: { id: proposal.id, status: proposal.status, target: proposal.target },
  recommendation: result.recommendation,
  reviewStatus: result.reviewStatus,
  usage: result.usage,
  nextStep: "Human review is required; this example does not approve or apply changes.",
}, null, 2));
