import assert from "node:assert/strict";
import test from "node:test";

import { ingestBatch, validateEvidence } from "../src/evidence.mjs";

const baseRecord = () => ({
  source: "synthetic-source",
  harness: "harness-a",
  session: "session-001",
  date: "2026-10-27T12:00:00Z",
  type: "benchmark",
  result: { score: 1 },
});

const withOverrides = (overrides = {}) => ({ ...baseRecord(), ...overrides });

// HAPPY PATH: registro válido
test("registro válido retorna valid true y errores vacíos", () => {
  // Arrange
  const record = baseRecord();
  // Act
  const outcome = validateEvidence(record);
  // Assert
  assert.equal(outcome.valid, true);
  assert.deepEqual(outcome.errors, []);
});

test("lote con un registro válido acepta con provenance y occurrences 1", () => {
  // Arrange
  const record = baseRecord();
  // Act
  const outcome = ingestBatch([record]);
  // Assert
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.rejected.length, 0);
  assert.equal(outcome.accepted[0].occurrences, 1);
  assert.deepEqual(outcome.accepted[0].provenance, [
    {
      source: "synthetic-source",
      harness: "harness-a",
      session: "session-001",
      date: "2026-10-27T12:00:00Z",
      batchIndex: 0,
    },
  ]);
  assert.equal(outcome.accepted[0].source, "synthetic-source");
  assert.equal(outcome.accepted[0].harness, "harness-a");
  assert.equal(outcome.accepted[0].session, "session-001");
  assert.equal(outcome.accepted[0].date, "2026-10-27T12:00:00Z");
  assert.equal(outcome.accepted[0].type, "benchmark");
  assert.deepEqual(outcome.accepted[0].result, { score: 1 });
});

test("identificadores con espacios se recortan en el valor aceptado", () => {
  // Arrange
  const record = withOverrides({
    source: "  synthetic-source  ",
    harness: "  harness-a ",
    session: " session-001 ",
    type: "  benchmark ",
  });
  // Act
  const outcome = ingestBatch([record]);
  // Assert
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.accepted[0].source, "synthetic-source");
  assert.equal(outcome.accepted[0].harness, "harness-a");
  assert.equal(outcome.accepted[0].session, "session-001");
  assert.equal(outcome.accepted[0].type, "benchmark");
});

// ERROR PATH: forma del registro
test("registro no plano se rechaza con error de record", () => {
  for (const invalid of [null, undefined, 42, "texto", []]) {
    const outcome = validateEvidence(invalid);
    assert.equal(outcome.valid, false);
    assert.equal(outcome.errors.length, 1);
    assert.deepEqual(outcome.errors[0], {
      field: "record",
      message: "Debe ser un objeto plano.",
    });
  }
});

test("registro con campo faltante reporta record más el campo ausente", () => {
  // Arrange
  const record = baseRecord();
  delete record.source;
  // Act
  const outcome = validateEvidence(record);
  // Assert
  assert.equal(outcome.valid, false);
  assert.equal(outcome.errors.length, 2);
  assert.deepEqual(outcome.errors[0], {
    field: "record",
    message: "Debe contener exactamente los seis campos requeridos.",
  });
  assert.deepEqual(outcome.errors[1], {
    field: "source",
    message: "El campo debe ser un dato propio y enumerable.",
  });
});

test("registro con campo adicional se rechaza", () => {
  // Arrange
  const record = { ...baseRecord(), extra: "no-permitido" };
  // Act
  const outcome = validateEvidence(record);
  // Assert
  assert.equal(outcome.valid, false);
  assert.equal(
    outcome.errors.some((error) => error.field === "record"),
    true,
  );
  assert.deepEqual(outcome.errors[0], {
    field: "record",
    message: "Debe contener exactamente los seis campos requeridos.",
  });
});

test("identificadores vacíos o en blanco se rechazan por campo", () => {
  for (const field of ["source", "harness", "session", "type"]) {
    const outcome = validateEvidence(withOverrides({ [field]: "   " }));
    assert.equal(outcome.valid, false);
    assert.deepEqual(outcome.errors, [
      {
        field,
        message: "Debe ser una cadena no vacía de hasta 1.024 caracteres.",
      },
    ]);
  }
});

test("identificador con tipo no cadena se rechaza", () => {
  const outcome = validateEvidence(withOverrides({ source: 123 }));
  assert.equal(outcome.valid, false);
  assert.deepEqual(outcome.errors, [
    {
      field: "source",
      message: "Debe ser una cadena no vacía de hasta 1.024 caracteres.",
    },
  ]);
});

// BOUNDARY: longitudes de identificador
test("identificador de 1024 caracteres es válido y de 1025 se rechaza", () => {
  const exact = "s".repeat(1024);
  const overflow = "s".repeat(1025);
  const okOutcome = validateEvidence(withOverrides({ source: exact }));
  assert.equal(okOutcome.valid, true);
  assert.deepEqual(okOutcome.errors, []);
  const badOutcome = validateEvidence(withOverrides({ source: overflow }));
  assert.equal(badOutcome.valid, false);
  assert.deepEqual(badOutcome.errors, [
    {
      field: "source",
      message: "Debe ser una cadena no vacía de hasta 1.024 caracteres.",
    },
  ]);
});

test("identificadores unicode se aceptan y recortan", () => {
  const record = withOverrides({ source: "  fuente-ñ-日本語-🚀  " });
  const outcome = ingestBatch([record]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.accepted[0].source, "fuente-ñ-日本語-🚀");
  assert.equal(outcome.rejected.length, 0);
});

// ERROR PATH: fechas
test("fechas no UTC o inexistentes se rechazan", () => {
  const invalidDates = [
    "2026-10-27 12:00:00",
    "2026-10-27T12:00:00",
    "2026-10-27T12:00:00+00:00",
    "2026-02-30T12:00:00Z",
    "2026-13-01T00:00:00Z",
    "no-fecha",
    "",
  ];
  for (const date of invalidDates) {
    const outcome = validateEvidence(withOverrides({ date }));
    assert.equal(outcome.valid, false);
    assert.deepEqual(outcome.errors, [
      { field: "date", message: "Debe ser una marca ISO 8601 UTC válida." },
    ]);
  }
});

test("fecha con tipo no cadena se rechaza", () => {
  const outcome = validateEvidence(withOverrides({ date: 20261027 }));
  assert.equal(outcome.valid, false);
  assert.deepEqual(outcome.errors, [
    { field: "date", message: "Debe ser una marca ISO 8601 UTC válida." },
  ]);
});

// DATE NORMALIZATION
test("fecha con fracción .1200Z se canoniza a .12Z", () => {
  const outcome = ingestBatch([
    withOverrides({ date: "2026-10-27T12:00:00.1200Z" }),
  ]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.accepted[0].date, "2026-10-27T12:00:00.12Z");
});

test("fecha con fracción solo ceros pierde la fracción", () => {
  const outcome = ingestBatch([
    withOverrides({ date: "2026-10-27T12:00:00.000Z" }),
  ]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.accepted[0].date, "2026-10-27T12:00:00Z");
});

test("fecha sin fracción se conserva intacta", () => {
  const outcome = ingestBatch([
    withOverrides({ date: "2026-10-27T12:00:00Z" }),
  ]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.accepted[0].date, "2026-10-27T12:00:00Z");
});

test("fecha con nueve dígitos fraccionarios es válida y con diez se rechaza", () => {
  const okDate = "2026-10-27T12:00:00.123456789Z";
  const badDate = "2026-10-27T12:00:00.1234567890Z";
  const okOutcome = validateEvidence(withOverrides({ date: okDate }));
  assert.equal(okOutcome.valid, true);
  assert.deepEqual(okOutcome.errors, []);
  const badOutcome = validateEvidence(withOverrides({ date: badDate }));
  assert.equal(badOutcome.valid, false);
  assert.deepEqual(badOutcome.errors, [
    { field: "date", message: "Debe ser una marca ISO 8601 UTC válida." },
  ]);
});

// RESULT HANDLING: valores aceptados
test("result admite null, booleanos, números finitos, cadenas, arreglos y objetos", () => {
  const values = [
    null,
    true,
    false,
    0,
    42,
    -3.5,
    "texto sintético",
    [],
    [1, "dos", null],
    {},
    { score: 1, tags: ["a", "b"], nested: { level: 2 } },
  ];
  for (const result of values) {
    const outcome = ingestBatch([withOverrides({ result })]);
    assert.equal(outcome.accepted.length, 1);
    assert.equal(outcome.rejected.length, 0);
    assert.deepEqual(outcome.accepted[0].result, result);
  }
});

test("result -0 se normaliza a 0", () => {
  const outcome = ingestBatch([withOverrides({ result: -0 })]);
  assert.equal(outcome.accepted.length, 1);
  assert.strictEqual(outcome.accepted[0].result, 0);
  assert.equal(Object.is(outcome.accepted[0].result, -0), false);
});

test("result rechaza NaN, Infinity y -Infinity", () => {
  for (const result of [NaN, Infinity, -Infinity]) {
    const outcome = validateEvidence(withOverrides({ result }));
    assert.equal(outcome.valid, false);
    assert.deepEqual(outcome.errors, [
      {
        field: "result",
        message:
          "Debe ser un valor JSON seguro y finito dentro de los límites permitidos.",
      },
    ]);
  }
});

test("result rechaza undefined, funciones y símbolos", () => {
  const badResults = [undefined, () => 1, Symbol("sintetico")];
  for (const result of badResults) {
    const outcome = validateEvidence(withOverrides({ result }));
    assert.equal(outcome.valid, false);
    assert.equal(outcome.errors.length, 1);
    assert.equal(outcome.errors[0].field, "result");
  }
});

test("result rechaza referencia circular", () => {
  const circular = { tag: "sintetico" };
  circular.self = circular;
  const outcome = validateEvidence(withOverrides({ result: circular }));
  assert.equal(outcome.valid, false);
  assert.deepEqual(outcome.errors, [
    {
      field: "result",
      message:
        "Debe ser un valor JSON seguro y finito dentro de los límites permitidos.",
    },
  ]);
});

test("result rechaza instancia de clase", () => {
  class Synthetic {
    constructor() {
      this.score = 1;
    }
  }
  const outcome = validateEvidence(
    withOverrides({ result: new Synthetic() }),
  );
  assert.equal(outcome.valid, false);
  assert.equal(outcome.errors.length, 1);
  assert.equal(outcome.errors[0].field, "result");
});

test("result rechaza cadena mayor a 100000 caracteres", () => {
  const outcome = validateEvidence(
    withOverrides({ result: "x".repeat(100_001) }),
  );
  assert.equal(outcome.valid, false);
  assert.deepEqual(outcome.errors, [
    {
      field: "result",
      message:
        "Debe ser un valor JSON seguro y finito dentro de los límites permitidos.",
    },
  ]);
});

test("result rechaza profundidad mayor a 100 niveles", () => {
  let deep = [];
  let cursor = deep;
  for (let level = 0; level < 101; level += 1) {
    const next = [];
    cursor.push(next);
    cursor = next;
  }
  const outcome = validateEvidence(withOverrides({ result: deep }));
  assert.equal(outcome.valid, false);
  assert.equal(outcome.errors.length, 1);
  assert.equal(outcome.errors[0].field, "result");
});

// BATCH: entradas inválidas
test("lote no arreglo retorna rechazo de lote con índice null", () => {
  for (const records of [null, undefined, "lista", 42, {}]) {
    const outcome = ingestBatch(records);
    assert.deepEqual(outcome.accepted, []);
    assert.equal(outcome.rejected.length, 1);
    assert.deepEqual(outcome.rejected[0], {
      index: null,
      errors: [
        {
          field: "records",
          message: "La entrada debe ser una lista de registros.",
        },
      ],
    });
  }
});

test("opciones no vacías retornan rechazo de lote con índice null", () => {
  const outcome = ingestBatch([baseRecord()], { strict: true });
  assert.deepEqual(outcome.accepted, []);
  assert.deepEqual(outcome.rejected, [
    {
      index: null,
      errors: [
        { field: "options", message: "Las opciones deben ser un objeto vacío." },
      ],
    },
  ]);
});

test("lote vacío retorna aceptados y rechazados vacíos", () => {
  const outcome = ingestBatch([]);
  assert.deepEqual(outcome.accepted, []);
  assert.deepEqual(outcome.rejected, []);
});

test("lote mezcla válidos e inválidos conservando índices", () => {
  const valid = baseRecord();
  const invalid = { ...baseRecord() };
  delete invalid.session;
  const outcome = ingestBatch([valid, invalid]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].index, 1);
  assert.equal(
    outcome.rejected[0].errors.some((error) => error.field === "record"),
    true,
  );
  assert.equal(
    outcome.rejected[0].errors.some((error) => error.field === "session"),
    true,
  );
});

// DUPLICADOS: occurrences + provenance
test("duplicados idénticos se agrupan con occurrences y provenance por aparición", () => {
  const record = baseRecord();
  const clone = baseRecord();
  const outcome = ingestBatch([record, clone, baseRecord()]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.rejected.length, 0);
  assert.equal(outcome.accepted[0].occurrences, 3);
  assert.equal(outcome.accepted[0].provenance.length, 3);
  assert.deepEqual(outcome.accepted[0].provenance, [
    {
      source: "synthetic-source",
      harness: "harness-a",
      session: "session-001",
      date: "2026-10-27T12:00:00Z",
      batchIndex: 0,
    },
    {
      source: "synthetic-source",
      harness: "harness-a",
      session: "session-001",
      date: "2026-10-27T12:00:00Z",
      batchIndex: 1,
    },
    {
      source: "synthetic-source",
      harness: "harness-a",
      session: "session-001",
      date: "2026-10-27T12:00:00Z",
      batchIndex: 2,
    },
  ]);
});

test("duplicados con espacios conservan originales en provenance y valor recortado", () => {
  const first = withOverrides({ source: "  synthetic-source  " });
  const second = withOverrides({ source: "synthetic-source" });
  const outcome = ingestBatch([first, second]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(outcome.accepted[0].occurrences, 2);
  assert.equal(outcome.accepted[0].source, "synthetic-source");
  assert.equal(outcome.accepted[0].provenance.length, 2);
  assert.equal(
    outcome.accepted[0].provenance[0].source,
    "  synthetic-source  ",
  );
  assert.equal(outcome.accepted[0].provenance[1].source, "synthetic-source");
  assert.equal(outcome.accepted[0].provenance[0].batchIndex, 0);
  assert.equal(outcome.accepted[0].provenance[1].batchIndex, 1);
});

test("lote intercalado conserva orden de primera aparición", () => {
  const groupA = baseRecord();
  const groupB = withOverrides({ harness: "harness-b" });
  const outcome = ingestBatch([groupA, groupB, baseRecord()]);
  assert.equal(outcome.accepted.length, 2);
  assert.equal(outcome.accepted[0].harness, "harness-a");
  assert.equal(outcome.accepted[0].occurrences, 2);
  assert.equal(outcome.accepted[1].harness, "harness-b");
  assert.equal(outcome.accepted[1].occurrences, 1);
  assert.deepEqual(
    outcome.accepted[0].provenance.map((item) => item.batchIndex),
    [0, 2],
  );
  assert.deepEqual(
    outcome.accepted[1].provenance.map((item) => item.batchIndex),
    [1],
  );
});

// HARNESS DISTINTO
test("arnés distinto produce registro separado", () => {
  const outcome = ingestBatch([
    baseRecord(),
    withOverrides({ harness: "harness-b" }),
  ]);
  assert.equal(outcome.accepted.length, 2);
  assert.equal(outcome.accepted[0].harness, "harness-a");
  assert.equal(outcome.accepted[1].harness, "harness-b");
  assert.equal(outcome.accepted[0].occurrences, 1);
  assert.equal(outcome.accepted[1].occurrences, 1);
  assert.equal(outcome.rejected.length, 0);
});

test("resultado distinto evita el agrupamiento", () => {
  const outcome = ingestBatch([
    withOverrides({ result: { score: 1 } }),
    withOverrides({ result: { score: 2 } }),
  ]);
  assert.equal(outcome.accepted.length, 2);
  assert.deepEqual(outcome.accepted[0].result, { score: 1 });
  assert.deepEqual(outcome.accepted[1].result, { score: 2 });
});

// SEGURIDAD: sin fuga de datos
test("errores no incluyen valores de entrada", () => {
  const marker = "MARCADOR-SINTETICO-9f3a1";
  const outcome = validateEvidence(
    withOverrides({ source: `  ${marker}  `, date: "no-fecha" }),
  );
  assert.equal(outcome.valid, false);
  assert.equal(JSON.stringify(outcome.errors).includes(marker), false);
});

test("rechazo de lote no copia el contenido rechazado", () => {
  const marker = "SECRETO-MARCADOR-SINTETICO-7b2c";
  const invalid = { ...baseRecord(), extra: marker };
  delete invalid.source;
  const outcome = ingestBatch([invalid]);
  assert.equal(outcome.accepted.length, 0);
  assert.equal(outcome.rejected.length, 1);
  assert.equal(outcome.rejected[0].index, 0);
  assert.deepEqual(Object.keys(outcome.rejected[0]).sort(), [
    "errors",
    "index",
  ]);
  assert.equal(JSON.stringify(outcome.rejected[0]).includes(marker), false);
});

test("ingesta no muta el registro de entrada", () => {
  const record = withOverrides({ source: "  synthetic-source  " });
  const before = JSON.stringify(record);
  const outcome = ingestBatch([record]);
  assert.equal(outcome.accepted.length, 1);
  assert.equal(JSON.stringify(record), before);
  assert.equal(record.source, "  synthetic-source  ");
});

// CROSS-SESSION: misma falla en sesiones distintas no se fusiona
test("misma falla en sesiones distintas no se fusiona en ingestBatch", () => {
  // Arrange
  const first = withOverrides({ session: "session-001" });
  const second = withOverrides({ session: "session-002" });
  // Act
  const outcome = ingestBatch([first, second]);
  // Assert
  assert.equal(outcome.accepted.length, 2);
  assert.equal(outcome.rejected.length, 0);
  assert.equal(outcome.accepted[0].occurrences, 1);
  assert.equal(outcome.accepted[1].occurrences, 1);
  assert.equal(outcome.accepted[0].session, "session-001");
  assert.equal(outcome.accepted[1].session, "session-002");
  assert.equal(outcome.accepted[0].provenance.length, 1);
  assert.equal(outcome.accepted[1].provenance.length, 1);
  assert.equal(outcome.accepted[0].provenance[0].session, "session-001");
  assert.equal(outcome.accepted[1].provenance[0].session, "session-002");
});
