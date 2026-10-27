import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { detectRecurrentFailures } from "../src/patterns.mjs";
import { buildProposals, reviewProposal } from "../src/proposals.mjs";

const PROPOSAL_KEYS_SORTED = [
  "code",
  "diagnosis",
  "eventCount",
  "evidenceRefs",
  "harness",
  "id",
  "origin",
  "sessionCount",
  "status",
  "target",
  "totalOccurrences",
  "type",
].sort();

const baseAccepted = (overrides = {}) => ({
  source: "synthetic-source",
  harness: "harness-a",
  session: "session-001",
  date: "2026-10-27T12:00:00Z",
  type: "benchmark",
  result: { status: "error", code: "E001", type: "T1" },
  provenance: [
    {
      source: "synthetic-source",
      harness: "harness-a",
      session: "session-001",
      date: "2026-10-27T12:00:00Z",
      batchIndex: 0,
    },
  ],
  occurrences: 1,
  ...overrides,
});

const failureRecord = ({ session, harness = "harness-a", code = "E001", type = "T1", date = "2026-10-27T12:00:00Z", occurrences = 1, provenanceSessions = null }) => {
  const provenance = provenanceSessions === null
    ? [
      {
        source: "synthetic-source",
        harness,
        session,
        date,
        batchIndex: 0,
      },
    ]
    : provenanceSessions.map((provenanceSession, index) => ({
      source: "synthetic-source",
      harness,
      session: provenanceSession,
      date,
      batchIndex: index,
    }));
  return baseAccepted({
    harness,
    session,
    date,
    result: { status: "error", code, type },
    provenance,
    occurrences,
  });
};

const syntheticPattern = (overrides = {}) => ({
  harness: "harness-a",
  code: "E001",
  type: "T1",
  eventCount: 2,
  totalOccurrences: 2,
  sessionCount: 2,
  evidenceRefs: [
    { acceptedIndex: 0, occurrences: 1 },
    { acceptedIndex: 1, occurrences: 1 },
  ],
  ...overrides,
});

const expectedIdFor = (harness, code, type) => {
  const patternKey = JSON.stringify([harness, code, type ?? ""]);
  const digest = createHash("sha256").update(patternKey).digest("hex");
  return { patternKey, id: `prop-sha256-${digest}` };
};

// HAPPY PATH: detect -> build exact counts + safe refs + pending
test("detect->build produce propuesta pending con conteos exactos y refs seguras", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  const proposals = buildProposals(patterns, { targetKind: "agent" });
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(proposals.length, 1);
  const proposal = proposals[0];
  assert.equal(proposal.harness, "harness-a");
  assert.equal(proposal.code, "E001");
  assert.equal(proposal.type, "T1");
  assert.equal(proposal.eventCount, 2);
  assert.equal(proposal.totalOccurrences, 2);
  assert.equal(proposal.sessionCount, 2);
  assert.equal(proposal.status, "pending");
  assert.deepEqual(proposal.evidenceRefs, [
    { acceptedIndex: 0, occurrences: 1 },
    { acceptedIndex: 1, occurrences: 1 },
  ]);
  assert.equal(proposal.diagnosis, "eventCount=2; totalOccurrences=2; sessionCount=2");
  assert.deepEqual(proposal.target, { kind: "agent", detail: null });
  assert.equal(proposal.origin.source, "detectRecurrentFailures");
  assert.equal(typeof proposal.origin.patternKey, "string");
});

// HAPPY PATH: eventCount vs totalOccurrences se preservan
test("build preserva eventCount y suma totalOccurrences", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", occurrences: 1 }),
    failureRecord({ session: "session-002", occurrences: 3 }),
  ];
  // Act
  const proposals = buildProposals(detectRecurrentFailures(accepted), { targetKind: "prompt" });
  // Assert
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].eventCount, 2);
  assert.equal(proposals[0].totalOccurrences, 4);
  assert.equal(proposals[0].sessionCount, 2);
  assert.equal(proposals[0].target.kind, "prompt");
  assert.equal(proposals[0].target.detail, null);
});

// STABLE SHA IDS: determinista y con prefijo
test("id es estable sha256 determinista para misma identidad", () => {
  // Arrange
  const pattern = syntheticPattern();
  // Act
  const first = buildProposals([pattern], { targetKind: "skill" });
  const second = buildProposals([structuredClone(pattern)], { targetKind: "skill" });
  // Assert
  const { patternKey, id } = expectedIdFor("harness-a", "E001", "T1");
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(first[0].id, id);
  assert.equal(second[0].id, id);
  assert.equal(first[0].id, second[0].id);
  assert.equal(first[0].origin.patternKey, patternKey);
  assert.match(first[0].id, /^prop-sha256-[0-9a-f]{64}$/u);
});

// AISLAMIENTO: distinto patron -> distinto id y conteos aislados
test("patrones distintos generan ids distintos y conteos aislados", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", code: "E001" }),
    failureRecord({ session: "session-002", code: "E001" }),
    failureRecord({ session: "session-001", code: "E002" }),
    failureRecord({ session: "session-002", code: "E002" }),
  ];
  // Act
  const proposals = buildProposals(detectRecurrentFailures(accepted), { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 2);
  const byCode = new Map(proposals.map((proposal) => [proposal.code, proposal]));
  assert.equal(byCode.size, 2);
  assert.notEqual(byCode.get("E001").id, byCode.get("E002").id);
  assert.equal(byCode.get("E001").eventCount, 2);
  assert.equal(byCode.get("E002").eventCount, 2);
  assert.equal(byCode.get("E001").harness, "harness-a");
  assert.equal(byCode.get("E002").harness, "harness-a");
});

// ORDEN: se preserva orden de entrada
test("build preserva orden de entrada de patrones", () => {
  // Arrange
  const patternB = syntheticPattern({ code: "E002", evidenceRefs: [{ acceptedIndex: 2, occurrences: 1 }, { acceptedIndex: 3, occurrences: 1 }] });
  const patternA = syntheticPattern({ code: "E001" });
  // Act
  const proposals = buildProposals([patternB, patternA], { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 2);
  assert.equal(proposals[0].code, "E002");
  assert.equal(proposals[1].code, "E001");
  assert.notEqual(proposals[0].id, proposals[1].id);
});

// TIPO NULL: type ausente se normaliza a null con clave canonica vacia
test("patron sin type produce propuesta con type null", () => {
  // Arrange
  const pattern = {
    harness: "harness-a",
    code: "E001",
    eventCount: 2,
    totalOccurrences: 2,
    sessionCount: 2,
    evidenceRefs: [{ acceptedIndex: 0, occurrences: 1 }, { acceptedIndex: 1, occurrences: 1 }],
  };
  // Act
  const proposals = buildProposals([pattern], { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].type, null);
  const { patternKey, id } = expectedIdFor("harness-a", "E001", null);
  assert.equal(proposals[0].origin.patternKey, patternKey);
  assert.equal(proposals[0].id, id);
});

// PRIVACIDAD: sin sesiones crudas ni campos raw
test("propuesta no expone sessions ni identificadores crudos", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  // Act
  const proposals = buildProposals(detectRecurrentFailures(accepted), { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 1);
  const proposal = proposals[0];
  assert.equal(Object.hasOwn(proposal, "sessions"), false);
  assert.equal(Object.hasOwn(proposal, "session"), false);
  assert.equal(Object.hasOwn(proposal, "source"), false);
  assert.equal(Object.hasOwn(proposal, "message"), false);
  assert.equal(Object.hasOwn(proposal, "remedy"), false);
  assert.deepEqual(Object.keys(proposal).sort(), PROPOSAL_KEYS_SORTED);
  const serialized = JSON.stringify(proposal);
  assert.equal(serialized.includes("session-001"), false);
  assert.equal(serialized.includes("session-002"), false);
  assert.equal(serialized.includes("synthetic-source"), false);
  for (const ref of proposal.evidenceRefs) {
    assert.deepEqual(Object.keys(ref).sort(), ["acceptedIndex", "occurrences"]);
  }
});

// PRIVACIDAD: evidenceRefs de detect se sanean a solo acceptedIndex+occurrences
test("evidenceRefs crudos de detect se sanean sin session harness date", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  const patterns = detectRecurrentFailures(accepted);
  // Act
  const proposals = buildProposals(patterns, { targetKind: "skill" });
  // Assert
  assert.equal(patterns[0].evidenceRefs[0].session, "session-001");
  assert.equal(proposals.length, 1);
  for (const ref of proposals[0].evidenceRefs) {
    assert.equal(Object.hasOwn(ref, "session"), false);
    assert.equal(Object.hasOwn(ref, "harness"), false);
    assert.equal(Object.hasOwn(ref, "date"), false);
  }
  assert.deepEqual(proposals[0].evidenceRefs, [
    { acceptedIndex: 0, occurrences: 1 },
    { acceptedIndex: 1, occurrences: 1 },
  ]);
});

// INSUFICIENTE: una sola sesion no genera propuesta
test("datos insuficientes con una sola sesion retornan vacio", () => {
  // Arrange
  const accepted = [failureRecord({ session: "session-001" })];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  const proposals = buildProposals(patterns, { targetKind: "agent" });
  // Assert
  assert.deepEqual(patterns, []);
  assert.deepEqual(proposals, []);
});

// FAIL-CLOSED: vacio y malformados se omiten sin lanzar
test("arreglo vacio retorna vacio", () => {
  // Arrange
  const patterns = [];
  // Act
  const proposals = buildProposals(patterns, { targetKind: "agent" });
  // Assert
  assert.deepEqual(proposals, []);
});

test("patrones malformados se omiten y el valido sobrevive", () => {
  // Arrange
  const valid = syntheticPattern();
  const patterns = [null, {}, { harness: "harness-a" }, valid, 42, "falla", []];
  // Act
  const proposals = buildProposals(patterns, { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].code, "E001");
  assert.equal(proposals[0].eventCount, 2);
});

test("conteos no positivos e identificadores invalidos se omiten", () => {
  // Arrange
  const valid = syntheticPattern();
  const badCounts = syntheticPattern({ eventCount: 0 });
  const badCode = syntheticPattern({ code: "E 001!" });
  const badRefs = syntheticPattern({ evidenceRefs: [{ acceptedIndex: -1, occurrences: 1 }] });
  // Act
  const proposals = buildProposals([badCounts, badCode, badRefs, valid], { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].code, "E001");
  assert.equal(proposals[0].eventCount, 2);
});

test("solo malformados retorna vacio", () => {
  // Arrange
  const patterns = [null, {}, { harness: "x" }];
  // Act
  const proposals = buildProposals(patterns, { targetKind: "agent" });
  // Assert
  assert.deepEqual(proposals, []);
});

// ERROR PATH: tipos de entrada
test("patterns no arreglo lanza TypeError exacto", () => {
  assert.throws(() => buildProposals(null, { targetKind: "agent" }), { name: "TypeError", message: "patterns must be an array." });
  assert.throws(() => buildProposals({}, { targetKind: "agent" }), { name: "TypeError", message: "patterns must be an array." });
  assert.throws(() => buildProposals("falla", { targetKind: "agent" }), { name: "TypeError", message: "patterns must be an array." });
});

test("options no objeto lanza TypeError exacto", () => {
  // Arrange
  const patterns = [syntheticPattern()];
  // Act + Assert
  assert.throws(() => buildProposals(patterns, null), { name: "TypeError", message: "options must be an object." });
  assert.throws(() => buildProposals(patterns, []), { name: "TypeError", message: "options must be an object." });
  assert.throws(() => buildProposals(patterns, "agent"), { name: "TypeError", message: "options must be an object." });
});

// TARGETKIND requerido explicito agent/prompt/skill
test("targetKind faltante o invalido lanza TypeError exacto", () => {
  // Arrange
  const patterns = [syntheticPattern()];
  // Act + Assert
  assert.throws(() => buildProposals(patterns, {}), { name: "TypeError", message: "options.targetKind must be agent, prompt, or skill." });
  assert.throws(() => buildProposals(patterns, { targetKind: "fix" }), { name: "TypeError", message: "options.targetKind must be agent, prompt, or skill." });
  assert.throws(() => buildProposals(patterns, { targetKind: "" }), { name: "TypeError", message: "options.targetKind must be agent, prompt, or skill." });
  assert.throws(() => buildProposals(patterns, { targetKind: null }), { name: "TypeError", message: "options.targetKind must be agent, prompt, or skill." });
  assert.throws(() => buildProposals(patterns, { targetKind: "AGENT" }), { name: "TypeError", message: "options.targetKind must be agent, prompt, or skill." });
});

test("targetKind agent prompt skill producen kind exacto con detail null", () => {
  // Arrange
  const pattern = syntheticPattern();
  // Act
  const forAgent = buildProposals([pattern], { targetKind: "agent" });
  const forPrompt = buildProposals([pattern], { targetKind: "prompt" });
  const forSkill = buildProposals([pattern], { targetKind: "skill" });
  // Assert
  assert.equal(forAgent[0].target.kind, "agent");
  assert.equal(forPrompt[0].target.kind, "prompt");
  assert.equal(forSkill[0].target.kind, "skill");
  assert.equal(forAgent[0].target.detail, null);
  assert.equal(forPrompt[0].target.detail, null);
  assert.equal(forSkill[0].target.detail, null);
});

// BOUNDARY: identificadores unicode y limites
test("identificadores unicode o vacios se omiten sin lanzar", () => {
  // Arrange
  const valid = syntheticPattern();
  const unicode = syntheticPattern({ harness: "harness-á" });
  const empty = syntheticPattern({ code: "" });
  const tooLong = syntheticPattern({ harness: `${"a".repeat(129)}` });
  // Act
  const proposals = buildProposals([unicode, empty, tooLong, valid], { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].harness, "harness-a");
});

test("type undefined se omite y maximo entero seguro se acepta", () => {
  // Arrange
  const undefinedType = syntheticPattern({ type: undefined });
  const maxSafe = syntheticPattern({ eventCount: Number.MAX_SAFE_INTEGER, totalOccurrences: Number.MAX_SAFE_INTEGER, sessionCount: Number.MAX_SAFE_INTEGER });
  // Act
  const proposals = buildProposals([undefinedType, maxSafe], { targetKind: "agent" });
  // Assert
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].eventCount, Number.MAX_SAFE_INTEGER);
  assert.equal(proposals[0].totalOccurrences, Number.MAX_SAFE_INTEGER);
  assert.equal(proposals[0].sessionCount, Number.MAX_SAFE_INTEGER);
});

// REVIEW: pending -> approve explicito
test("review approve cambia a approved sin mutar original", () => {
  // Arrange
  const [pending] = buildProposals([syntheticPattern()], { targetKind: "agent" });
  const before = structuredClone(pending);
  // Act
  const decided = reviewProposal(pending, "approve");
  // Assert
  assert.equal(decided.status, "approved");
  assert.equal(decided.id, pending.id);
  assert.equal(decided.harness, "harness-a");
  assert.equal(decided.code, "E001");
  assert.deepEqual(decided.origin, pending.origin);
  assert.equal(decided.target.kind, "agent");
  assert.equal(decided.target.detail, null);
  assert.notEqual(decided, pending);
  assert.deepEqual(pending, before);
  assert.equal(pending.status, "pending");
});

// REVIEW: pending -> reject explicito
test("review reject cambia a rejected con mismos conteos", () => {
  // Arrange
  const [pending] = buildProposals([syntheticPattern()], { targetKind: "prompt" });
  // Act
  const decided = reviewProposal(pending, "reject");
  // Assert
  assert.equal(decided.status, "rejected");
  assert.equal(decided.id, pending.id);
  assert.equal(decided.eventCount, 2);
  assert.equal(decided.totalOccurrences, 2);
  assert.equal(decided.sessionCount, 2);
  assert.equal(decided.diagnosis, "eventCount=2; totalOccurrences=2; sessionCount=2");
  assert.deepEqual(Object.keys(decided).sort(), PROPOSAL_KEYS_SORTED);
});

// REVIEW: accion invalida
test("accion invalida lanza TypeError exacto", () => {
  // Arrange
  const [pending] = buildProposals([syntheticPattern()], { targetKind: "agent" });
  // Act + Assert
  assert.throws(() => reviewProposal(pending, "fix"), { name: "TypeError", message: "action must be approve or reject." });
  assert.throws(() => reviewProposal(pending, ""), { name: "TypeError", message: "action must be approve or reject." });
  assert.throws(() => reviewProposal(pending, "APPROVE"), { name: "TypeError", message: "action must be approve or reject." });
  assert.throws(() => reviewProposal(pending, null), { name: "TypeError", message: "action must be approve or reject." });
  assert.throws(() => reviewProposal(pending, undefined), { name: "TypeError", message: "action must be approve or reject." });
});

// REVIEW: propuesta invalida fail-closed
test("propuesta invalida lanza TypeError exacto", () => {
  // Arrange
  const [pending] = buildProposals([syntheticPattern()], { targetKind: "agent" });
  const tamperedId = { ...pending, id: "prop-sha256-00" };
  const tamperedDiagnosis = { ...pending, diagnosis: "inventado" };
  const extraKey = { ...pending, remedy: "hacer algo" };
  const { status, ...missingStatus } = pending;
  // Act + Assert
  assert.throws(() => reviewProposal(null, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal({}, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(tamperedId, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(tamperedDiagnosis, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(extraKey, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(missingStatus, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.equal(status, "pending");
});

// REVIEW: accion se valida antes que propuesta
test("accion invalida prevalece sobre propuesta invalida", () => {
  // Act + Assert
  assert.throws(() => reviewProposal(null, "fix"), { name: "TypeError", message: "action must be approve or reject." });
});

// REVIEW: decisiones repetidas fail-closed
test("decision repetida sobre approved o rejected lanza TypeError", () => {
  // Arrange
  const [pending] = buildProposals([syntheticPattern()], { targetKind: "skill" });
  const approved = reviewProposal(pending, "approve");
  const rejected = reviewProposal(pending, "reject");
  // Act + Assert
  assert.equal(approved.status, "approved");
  assert.equal(rejected.status, "rejected");
  assert.throws(() => reviewProposal(approved, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(approved, "reject"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(rejected, "approve"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
  assert.throws(() => reviewProposal(rejected, "reject"), { name: "TypeError", message: "proposal must be a valid pending proposal." });
});

// INMUTABILIDAD: entradas no mutan y salida es determinista pura
test("build y review no mutan entradas y son deterministicos", () => {
  // Arrange
  const pattern = syntheticPattern();
  const patternSnapshot = structuredClone(pattern);
  const [pending] = buildProposals([pattern], { targetKind: "agent" });
  const pendingSnapshot = structuredClone(pending);
  // Act
  const again = buildProposals([pattern], { targetKind: "agent" });
  const decidedFirst = reviewProposal(pending, "approve");
  const decidedSecond = reviewProposal(pending, "approve");
  // Assert
  assert.deepEqual(pattern, patternSnapshot);
  assert.deepEqual(pending, pendingSnapshot);
  assert.deepEqual(again, [pending]);
  assert.deepEqual(decidedFirst, decidedSecond);
  assert.equal(decidedFirst.status, "approved");
  assert.equal(pending.status, "pending");
});

// PUREZA: sin persistencia ni cambios externos en objeto revisado
test("objeto revisado conserva forma exacta sin remedy ni sesiones", () => {
  // Arrange
  const [pending] = buildProposals([syntheticPattern()], { targetKind: "agent" });
  // Act
  const decided = reviewProposal(pending, "reject");
  // Assert
  assert.deepEqual(Object.keys(decided).sort(), PROPOSAL_KEYS_SORTED);
  assert.equal(Object.hasOwn(decided, "remedy"), false);
  assert.equal(Object.hasOwn(decided, "sessions"), false);
  assert.equal(decided.target.detail, null);
  assert.equal(decided.origin.source, "detectRecurrentFailures");
  assert.equal(JSON.stringify(decided).includes("session-001"), false);
});
