const EVIDENCE_FIELDS = Object.freeze([
  "source",
  "harness",
  "session",
  "date",
  "type",
  "result",
]);
const IDENTIFIER_FIELDS = new Set(["source", "harness", "session", "type"]);
const MAX_IDENTIFIER_LENGTH = 1_024;
const MAX_RESULT_DEPTH = 100;
const MAX_RESULT_NODES = 10_000;
const MAX_RESULT_STRING_LENGTH = 100_000;
const MAX_RESULT_CHARACTERS = 1_000_000;
const MAX_DATE_LENGTH = 30;

function makeError(field, message) {
  return { field, message };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(value, depth, state) {
  state.nodes += 1;
  if (state.nodes > MAX_RESULT_NODES || depth > MAX_RESULT_DEPTH) return null;
  if (value === null || typeof value === "boolean") return { value };
  if (typeof value === "string") return cloneString(value, state);
  if (typeof value === "number") return cloneNumber(value);
  if (typeof value !== "object" || state.ancestors.has(value)) return null;

  state.ancestors.add(value);
  try {
    if (Array.isArray(value)) return cloneArray(value, depth, state);
    return isPlainObject(value) ? cloneObject(value, depth, state) : null;
  } finally {
    state.ancestors.delete(value);
  }
}

function cloneString(value, state) {
  if (value.length > MAX_RESULT_STRING_LENGTH) return null;
  state.characters += value.length;
  return state.characters <= MAX_RESULT_CHARACTERS ? { value } : null;
}

function cloneNumber(value) {
  if (!Number.isFinite(value)) return null;
  return { value: Object.is(value, -0) ? 0 : value };
}

function cloneArray(value, depth, state) {
  if (Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || Reflect.ownKeys(value).length !== length + 1) return null;

  const copy = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) return null;
    const child = cloneJsonValue(descriptor.value, depth + 1, state);
    if (!child) return null;
    copy.push(child.value);
  }
  return { value: copy };
}

function cloneObject(value, depth, state) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return null;
  keys.sort();
  const copy = {};

  for (const key of keys) {
    if (key.length > MAX_RESULT_STRING_LENGTH) return null;
    state.characters += key.length;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (state.characters > MAX_RESULT_CHARACTERS || !descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      return null;
    }
    const child = cloneJsonValue(descriptor.value, depth + 1, state);
    if (!child) return null;
    Object.defineProperty(copy, key, {
      value: child.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return { value: copy };
}

function normalizeUtcDate(value) {
  if (value.length > MAX_DATE_LENGTH) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second, fraction = ""] = match;
  const [y, mo, d, h, mi, s] = [year, month, day, hour, minute, second].map(Number);
  const timestamp = new Date(0);
  timestamp.setUTCFullYear(y, mo - 1, d);
  timestamp.setUTCHours(h, mi, s, Number(fraction.slice(0, 3).padEnd(3, "0")));
  if (
    timestamp.getUTCFullYear() !== y || timestamp.getUTCMonth() !== mo - 1 ||
    timestamp.getUTCDate() !== d || timestamp.getUTCHours() !== h ||
    timestamp.getUTCMinutes() !== mi || timestamp.getUTCSeconds() !== s
  ) return null;

  const base = timestamp.toISOString().slice(0, 19);
  const normalizedFraction = fraction.replace(/0+$/, "");
  return `${base}${normalizedFraction ? `.${normalizedFraction}` : ""}Z`;
}

function normalizeField(field, input, value, errors) {
  if (IDENTIFIER_FIELDS.has(field)) return normalizeIdentifier(field, input, value, errors);
  if (field === "date") {
    const normalized = typeof input === "string" ? normalizeUtcDate(input) : null;
    if (normalized === null) errors.push(makeError(field, "Debe ser una marca ISO 8601 UTC válida."));
    else value[field] = normalized;
    return null;
  }
  return normalizeResult(input, value, errors);
}

function normalizeIdentifier(field, input, value, errors) {
  if (typeof input !== "string" || input.trim().length === 0 || input.length > MAX_IDENTIFIER_LENGTH) {
    errors.push(makeError(field, "Debe ser una cadena no vacía de hasta 1.024 caracteres."));
    return null;
  }
  value[field] = input.trim();
  return null;
}

function normalizeResult(input, value, errors) {
  const cloned = cloneJsonValue(input, 0, {
    ancestors: new WeakSet(),
    nodes: 0,
    characters: 0,
  });
  if (!cloned) {
    errors.push(makeError("result", "Debe ser un valor JSON seguro y finito dentro de los límites permitidos."));
    return null;
  }
  value.result = cloned.value;
  return JSON.stringify(cloned.value);
}

function inspectEvidence(record) {
  try {
    return inspectEvidenceSafely(record);
  } catch {
    return { value: null, key: null, errors: [makeError("record", "El registro no pudo validarse de forma segura.")] };
  }
}

function inspectEvidenceSafely(record) {
  if (!isPlainObject(record)) {
    return { value: null, key: null, errors: [makeError("record", "Debe ser un objeto plano.")] };
  }
  const errors = [];
  const keys = Reflect.ownKeys(record);
  if (keys.length !== EVIDENCE_FIELDS.length || keys.some((key) => !EVIDENCE_FIELDS.includes(key))) {
    errors.push(makeError("record", "Debe contener exactamente los seis campos requeridos."));
  }

  const value = {};
  const originalProvenance = {};
  let resultCanonical;
  for (const field of EVIDENCE_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(record, field);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      errors.push(makeError(field, "El campo debe ser un dato propio y enumerable."));
      continue;
    }
    const canonical = normalizeField(field, descriptor.value, value, errors);
    if (field === "result") resultCanonical = canonical;
    if (field === "source" || field === "harness" || field === "session" || field === "date") {
      originalProvenance[field] = descriptor.value;
    }
  }
  if (errors.length > 0) return { value: null, key: null, errors };

  const key = JSON.stringify([
    value.source,
    value.harness,
    value.session,
    value.date,
    value.type,
    resultCanonical,
  ]);
  return { value, key, errors, originalProvenance };
}

function batchFailure(field, message) {
  return { accepted: [], rejected: [{ index: null, errors: [makeError(field, message)] }] };
}

function hasEmptyOptions(options) {
  return isPlainObject(options) && Reflect.ownKeys(options).length === 0;
}

function batchLength(records) {
  if (!Array.isArray(records) || Object.getPrototypeOf(records) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(records, "length")?.value;
  if (!Number.isSafeInteger(length)) return null;
  for (const key of Reflect.ownKeys(records)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) return null;
  }
  return length;
}

function provenanceFor(original, batchIndex) {
  return {
    source: original.source,
    harness: original.harness,
    session: original.session,
    date: original.date,
    batchIndex,
  };
}

function processBatch(records, length) {
  const accepted = [];
  const rejected = [];
  const groups = new Map();
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(records, String(index));
    const inspected = descriptor?.enumerable && Object.hasOwn(descriptor, "value")
      ? inspectEvidence(descriptor.value)
      : { value: null, key: null, errors: [makeError("record", "El registro debe ser un dato propio y enumerable.")] };
    if (inspected.errors.length > 0) {
      rejected.push({ index, errors: inspected.errors });
      continue;
    }

    const duplicate = groups.get(inspected.key);
    if (duplicate) {
      duplicate.occurrences += 1;
      duplicate.provenance.push(provenanceFor(inspected.originalProvenance, index));
      continue;
    }
    const entry = {
      ...inspected.value,
      provenance: [provenanceFor(inspected.originalProvenance, index)],
      occurrences: 1,
    };
    groups.set(inspected.key, entry);
    accepted.push(entry);
  }
  return { accepted, rejected };
}

export function validateEvidence(record) {
  const { errors } = inspectEvidence(record);
  return { valid: errors.length === 0, errors };
}

export function ingestBatch(records, options = {}) {
  try {
    if (!hasEmptyOptions(options)) return batchFailure("options", "Las opciones deben ser un objeto vacío.");
    const length = batchLength(records);
    if (length === null) return batchFailure("records", "La entrada debe ser una lista de registros.");
    return processBatch(records, length);
  } catch {
    return batchFailure("records", "La lista no pudo procesarse de forma segura.");
  }
}
