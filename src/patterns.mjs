const MAX_IDENTIFIER_LENGTH = 1_024;
const MAX_DATE_LENGTH = 30;
const MAX_RESULT_DEPTH = 100;
const MAX_RESULT_NODES = 10_000;
const MAX_RESULT_STRING_LENGTH = 100_000;
const MAX_RESULT_CHARACTERS = 1_000_000;
const DEFAULT_MIN_SESSIONS = 2;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonSafe(value, depth, state) {
  state.nodes += 1;
  if (state.nodes > MAX_RESULT_NODES || depth > MAX_RESULT_DEPTH) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return isSafeString(value, state);
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || state.ancestors.has(value)) return false;

  state.ancestors.add(value);
  try {
    return Array.isArray(value) ? isJsonSafeArray(value, depth, state) : isJsonSafeObject(value, depth, state);
  } finally {
    state.ancestors.delete(value);
  }
}

function isSafeString(value, state) {
  if (value.length > MAX_RESULT_STRING_LENGTH) return false;
  state.characters += value.length;
  return state.characters <= MAX_RESULT_CHARACTERS;
}

function isJsonSafeArray(value, depth, state) {
  if (Object.getPrototypeOf(value) !== Array.prototype) return false;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || Reflect.ownKeys(value).length !== length + 1) return false;

  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) return false;
    if (!isJsonSafe(descriptor.value, depth + 1, state)) return false;
  }
  return true;
}

function isJsonSafeObject(value, depth, state) {
  if (!isPlainObject(value)) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !isSafeString(key, state)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) return false;
    if (!isJsonSafe(descriptor.value, depth + 1, state)) return false;
  }
  return true;
}

function normalizeIdentifier(value) {
  if (typeof value !== "string" || value.length > MAX_IDENTIFIER_LENGTH) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUtcDate(value) {
  if (typeof value !== "string" || value.length > MAX_DATE_LENGTH) return null;
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

function readEnumerableValue(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) return { valid: false };
  return { valid: true, value: descriptor.value };
}

function resolveAliases(result, names) {
  const values = new Set();
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(result, name);
    if (!descriptor) continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value")) return { valid: false };
    if (typeof descriptor.value !== "string") continue;
    const normalized = descriptor.value.trim();
    if (normalized.length > 0) values.add(normalized);
  }
  if (values.size > 1) return { valid: false };
  return { valid: true, value: values.size === 0 ? null : values.values().next().value };
}

function provenanceSessions(record) {
  const descriptor = Object.getOwnPropertyDescriptor(record, "provenance");
  if (!descriptor) return [];
  if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value") || !Array.isArray(descriptor.value)) return null;

  const provenance = descriptor.value;
  const length = Object.getOwnPropertyDescriptor(provenance, "length")?.value;
  if (Object.getPrototypeOf(provenance) !== Array.prototype || Reflect.ownKeys(provenance).length !== length + 1) return null;
  const sessions = [];
  for (let index = 0; index < length; index += 1) {
    const itemDescriptor = Object.getOwnPropertyDescriptor(provenance, String(index));
    if (!itemDescriptor?.enumerable || !Object.hasOwn(itemDescriptor, "value") || !isPlainObject(itemDescriptor.value)) return null;
    const session = readEnumerableValue(itemDescriptor.value, "session");
    const normalized = session.valid ? normalizeIdentifier(session.value) : null;
    if (normalized === null) return null;
    sessions.push(normalized);
  }
  return sessions;
}

function inspectRecord(record) {
  if (!isPlainObject(record)) return null;
  const harnessField = readEnumerableValue(record, "harness");
  const sessionField = readEnumerableValue(record, "session");
  const dateField = readEnumerableValue(record, "date");
  const resultField = readEnumerableValue(record, "result");
  if (!harnessField.valid || !sessionField.valid || !dateField.valid || !resultField.valid) return null;

  const harness = normalizeIdentifier(harnessField.value);
  const session = normalizeIdentifier(sessionField.value);
  const date = normalizeUtcDate(dateField.value);
  const result = resultField.value;
  if (harness === null || session === null || date === null || !isPlainObject(result)) return null;
  if (!isJsonSafe(result, 0, { ancestors: new WeakSet(), nodes: 0, characters: 0 })) return null;

  const status = readEnumerableValue(result, "status");
  if (!status.valid || (status.value !== "error" && status.value !== "failure")) return null;
  const code = resolveAliases(result, ["code", "failureCode"]);
  const type = resolveAliases(result, ["type", "failureType", "failure_type"]);
  if (!code.valid || !type.valid || code.value === null) return null;

  const priorSessions = provenanceSessions(record);
  if (priorSessions === null) return null;
  const sessions = new Set([session, ...priorSessions]);
  const occurrencesField = readEnumerableValue(record, "occurrences");
  const occurrences = occurrencesField.valid && Number.isSafeInteger(occurrencesField.value) && occurrencesField.value > 0
    ? occurrencesField.value
    : 1;
  return { harness, code: code.value, type: type.value, session, date, sessions, occurrences };
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function getMinSessions(options) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("options must be an object.");
  }
  const descriptor = Object.getOwnPropertyDescriptor(options, "minSessions");
  if (!descriptor) return DEFAULT_MIN_SESSIONS;
  if (!Object.hasOwn(descriptor, "value")) throw new TypeError("minSessions must be a data property.");
  const value = descriptor.value;
  if (!Number.isInteger(value)) throw new TypeError("minSessions must be an integer.");
  if (value < DEFAULT_MIN_SESSIONS) throw new RangeError("minSessions must be at least 2.");
  return value;
}

export function detectRecurrentFailures(acceptedRecords, options = {}) {
  if (!Array.isArray(acceptedRecords)) throw new TypeError("acceptedRecords must be an array.");
  const minSessions = getMinSessions(options);
  const groups = new Map();

  for (let acceptedIndex = 0; acceptedIndex < acceptedRecords.length; acceptedIndex += 1) {
    let item;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(acceptedRecords, String(acceptedIndex));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) continue;
      item = inspectRecord(descriptor.value);
    } catch {
      continue;
    }
    if (item !== null) addToGroup(groups, item, acceptedIndex);
  }

  return [...groups.values()]
    .filter((group) => group.sessions.size >= minSessions)
    .map(toPattern)
    .sort(comparePatterns);
}

function addToGroup(groups, item, acceptedIndex) {
  const identity = JSON.stringify([item.harness, item.code, item.type ?? ""]);
  let group = groups.get(identity);
  if (!group) {
    group = {
      harness: item.harness,
      code: item.code,
      type: item.type,
      eventCount: 0,
      totalOccurrences: 0,
      sessions: new Set(),
      evidenceRefs: [],
    };
    groups.set(identity, group);
  }

  group.eventCount += 1;
  group.totalOccurrences += item.occurrences;
  for (const session of item.sessions) group.sessions.add(session);
  group.evidenceRefs.push({ acceptedIndex, session: item.session, harness: item.harness, date: item.date, occurrences: item.occurrences });
}

function toPattern(group) {
  const sessions = [...group.sessions].sort(compareText);
  return {
    harness: group.harness,
    code: group.code,
    type: group.type,
    eventCount: group.eventCount,
    totalOccurrences: group.totalOccurrences,
    sessionCount: sessions.length,
    sessions,
    evidenceRefs: group.evidenceRefs,
  };
}

function comparePatterns(left, right) {
  return compareText(left.harness, right.harness) || compareText(left.code, right.code) || compareText(left.type ?? "", right.type ?? "");
}
