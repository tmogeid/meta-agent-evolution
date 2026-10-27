import assert from "node:assert/strict";
import test from "node:test";

import { detectRecurrentFailures } from "../src/patterns.mjs";

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

// HAPPY PATH: misma falla en dos sesiones
test("misma falla en dos sesiones detecta patron con conteos exactos", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].harness, "harness-a");
  assert.equal(patterns[0].code, "E001");
  assert.equal(patterns[0].type, "T1");
  assert.equal(patterns[0].eventCount, 2);
  assert.equal(patterns[0].totalOccurrences, 2);
  assert.equal(patterns[0].sessionCount, 2);
  assert.deepEqual(patterns[0].sessions, ["session-001", "session-002"]);
  assert.equal(patterns[0].evidenceRefs.length, 2);
});

// eventCount vs totalOccurrences vs sessionCount/provenance
test("eventCount cuenta eventos y totalOccurrences suma occurrences", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", occurrences: 1 }),
    failureRecord({ session: "session-002", occurrences: 3 }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].eventCount, 2);
  assert.equal(patterns[0].totalOccurrences, 4);
  assert.equal(patterns[0].sessionCount, 2);
  assert.deepEqual(patterns[0].sessions, ["session-001", "session-002"]);
});

test("provenance con sesiones extra cuenta para sessionCount aunque eventCount sea 1", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", provenanceSessions: ["session-001", "session-002", "session-003"] }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].eventCount, 1);
  assert.equal(patterns[0].totalOccurrences, 1);
  assert.equal(patterns[0].sessionCount, 3);
  assert.deepEqual(patterns[0].sessions, ["session-001", "session-002", "session-003"]);
});

// ERROR PATH: sin recurrencia bajo umbral
test("falla en una sola sesion no genera patron", () => {
  // Arrange
  const accepted = [failureRecord({ session: "session-001" })];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.deepEqual(patterns, []);
});

test("dos sesiones no alcanzan minSessions 3", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted, { minSessions: 3 });
  // Assert
  assert.deepEqual(patterns, []);
});

// ERROR PATH: fallas distintas y arneses separados
test("codigo distinto separa patrones", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", code: "E001" }),
    failureRecord({ session: "session-002", code: "E001" }),
    failureRecord({ session: "session-001", code: "E002" }),
    failureRecord({ session: "session-002", code: "E002" }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 2);
  assert.equal(patterns[0].code, "E001");
  assert.equal(patterns[1].code, "E002");
});

test("harness distinto separa patrones", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", harness: "harness-a" }),
    failureRecord({ session: "session-002", harness: "harness-a" }),
    failureRecord({ session: "session-001", harness: "harness-b" }),
    failureRecord({ session: "session-002", harness: "harness-b" }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 2);
  assert.equal(patterns[0].harness, "harness-a");
  assert.equal(patterns[1].harness, "harness-b");
});

// ERROR PATH: resultados arbitrarios no son fallas
test("resultados sin status de falla se ignoran", () => {
  // Arrange
  const accepted = [
    baseAccepted({ session: "session-001", result: { score: 1 } }),
    baseAccepted({ session: "session-002", result: { score: 1 } }),
    baseAccepted({ session: "session-001", result: { status: "ok", code: "E001", type: "T1" } }),
    baseAccepted({ session: "session-002", result: { status: "ok", code: "E001", type: "T1" } }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.deepEqual(patterns, []);
});

test("status error sin code se ignora", () => {
  // Arrange
  const accepted = [
    baseAccepted({ session: "session-001", result: { status: "error", type: "T1" } }),
    baseAccepted({ session: "session-002", result: { status: "error", type: "T1" } }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.deepEqual(patterns, []);
});

// BOUNDARY + FAIL CLOSED: aceptados malformados se omiten
test("registros malformados se omiten sin romper deteccion valida", () => {
  // Arrange
  const valid = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  const accepted = [null, {}, { harness: "harness-a" }, ...valid];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].eventCount, 2);
  assert.equal(patterns[0].sessionCount, 2);
});

test("solo malformados retorna vacio", () => {
  // Arrange
  const accepted = [null, 42, "falla", {}, []];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.deepEqual(patterns, []);
});

test("provenance malformada omite el registro", () => {
  // Arrange
  const bad = baseAccepted({ session: "session-001", provenance: "no-array" });
  const accepted = [
    bad,
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].eventCount, 2);
});

// ERROR PATH: accepted y options malformados lanzan mensaje exacto
test("accepted no array lanza TypeError exacto", () => {
  // Arrange
  const badInputs = [null, {}, "lista"];
  // Act + Assert
  for (const bad of badInputs) {
    assert.throws(() => detectRecurrentFailures(bad), /acceptedRecords must be an array\./u);
  }
  assert.deepEqual(detectRecurrentFailures([]), []);
});

test("options malformadas lanzan mensajes exactos", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001" }),
    failureRecord({ session: "session-002" }),
  ];
  // Act + Assert
  assert.throws(() => detectRecurrentFailures(accepted, null), /options must be an object\./u);
  assert.throws(() => detectRecurrentFailures(accepted, []), /options must be an object\./u);
  assert.throws(() => detectRecurrentFailures(accepted, { minSessions: 1 }), /minSessions must be at least 2\./u);
  assert.throws(() => detectRecurrentFailures(accepted, { minSessions: 2.5 }), /minSessions must be an integer\./u);
  const accessor = {};
  Object.defineProperty(accessor, "minSessions", { enumerable: true, configurable: true, get: () => 2 });
  assert.throws(() => detectRecurrentFailures(accepted, accessor), /minSessions must be a data property\./u);
});

// ALIAS: conflictos se omiten, coincidentes se agrupan
test("conflicto de alias code vs failureCode se omite", () => {
  // Arrange
  const accepted = [
    baseAccepted({ session: "session-001", result: { status: "error", code: "E001", failureCode: "E002", type: "T1" } }),
    baseAccepted({ session: "session-002", result: { status: "error", code: "E001", failureCode: "E002", type: "T1" } }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.deepEqual(patterns, []);
});

test("conflicto de alias type vs failureType se omite", () => {
  // Arrange
  const accepted = [
    baseAccepted({ session: "session-001", result: { status: "failure", code: "E001", type: "TA", failureType: "TB" } }),
    baseAccepted({ session: "session-002", result: { status: "failure", code: "E001", type: "TA", failureType: "TB" } }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.deepEqual(patterns, []);
});

test("alias coincidentes con espacios agrupan tras recorte", () => {
  // Arrange
  const accepted = [
    baseAccepted({ session: "session-001", result: { status: "failure", failureCode: "  E009  ", failureType: "  TF  " } }),
    baseAccepted({ session: "session-002", result: { status: "failure", code: "E009", type: "TF" } }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].code, "E009");
  assert.equal(patterns[0].type, "TF");
  assert.equal(patterns[0].sessionCount, 2);
});

// DETERMINISMO: orden por harness, code, type y sesiones ordenadas
test("salida ordenada por harness luego code luego type", () => {
  // Arrange
  const accepted = [
    failureRecord({ session: "session-001", harness: "harness-b", code: "E001", type: "T1" }),
    failureRecord({ session: "session-002", harness: "harness-b", code: "E001", type: "T1" }),
    failureRecord({ session: "session-001", harness: "harness-a", code: "E002", type: "T1" }),
    failureRecord({ session: "session-002", harness: "harness-a", code: "E002", type: "T1" }),
    failureRecord({ session: "session-001", harness: "harness-a", code: "E001", type: "T1" }),
    failureRecord({ session: "session-002", harness: "harness-a", code: "E001", type: "T1" }),
  ];
  // Act
  const first = detectRecurrentFailures(accepted);
  const second = detectRecurrentFailures([...accepted].reverse());
  // Assert
  assert.deepEqual(
    first.map((pattern) => [pattern.harness, pattern.code, pattern.type]),
    [["harness-a", "E001", "T1"], ["harness-a", "E002", "T1"], ["harness-b", "E001", "T1"]],
  );
  assert.deepEqual(
    second.map((pattern) => [pattern.harness, pattern.code, pattern.type]),
    [["harness-a", "E001", "T1"], ["harness-a", "E002", "T1"], ["harness-b", "E001", "T1"]],
  );
  assert.deepEqual(first[0].sessions, ["session-001", "session-002"]);
});

// BOUNDARY: type ausente agrupa como null y vacio no falla
test("type ausente agrupa con type null", () => {
  // Arrange
  const accepted = [
    baseAccepted({ session: "session-001", result: { status: "error", code: "E007" } }),
    baseAccepted({ session: "session-002", result: { status: "error", code: "E007" } }),
  ];
  // Act
  const patterns = detectRecurrentFailures(accepted);
  // Assert
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].code, "E007");
  assert.equal(patterns[0].type, null);
  assert.equal(patterns[0].sessionCount, 2);
});
