import { createHash } from "node:crypto";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const TARGET_KINDS = new Set(["agent", "prompt", "skill"]);
const REVIEW_ACTIONS = new Set(["approve", "reject"]);
const PROPOSAL_KEYS = [
  "id",
  "harness",
  "code",
  "type",
  "eventCount",
  "totalOccurrences",
  "sessionCount",
  "evidenceRefs",
  "diagnosis",
  "status",
  "origin",
  "target",
];

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readDataProperty(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) return undefined;
  return descriptor.value;
}

function hasExactKeys(value, expectedKeys) {
  const keys = Reflect.ownKeys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => keys.includes(key));
}

function isIdentifier(value) {
  if (typeof value !== "string") return false;
  return value.match(IDENTIFIER_PATTERN)?.[0] === value;
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function makePatternKey(harness, code, type) {
  return JSON.stringify([harness, code, type ?? ""]);
}

function makeId(patternKey) {
  const digest = createHash("sha256").update(patternKey).digest("hex");
  return `prop-sha256-${digest}`;
}

function makeDiagnosis(eventCount, totalOccurrences, sessionCount) {
  return `eventCount=${eventCount}; totalOccurrences=${totalOccurrences}; sessionCount=${sessionCount}`;
}

function readEvidenceRefs(value, requireSafeShape = false) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || Reflect.ownKeys(value).length !== length + 1) return null;

  const evidenceRefs = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || !isPlainObject(descriptor.value)) return null;
    if (requireSafeShape && !hasExactKeys(descriptor.value, ["acceptedIndex", "occurrences"])) return null;
    const acceptedIndex = readDataProperty(descriptor.value, "acceptedIndex");
    const occurrences = readDataProperty(descriptor.value, "occurrences");
    if (!Number.isSafeInteger(acceptedIndex) || acceptedIndex < 0 || !isPositiveSafeInteger(occurrences)) return null;
    evidenceRefs.push({ acceptedIndex, occurrences });
  }
  return evidenceRefs;
}

function inspectPattern(pattern) {
  if (!isPlainObject(pattern)) return null;
  const harness = readDataProperty(pattern, "harness");
  const code = readDataProperty(pattern, "code");
  const typeDescriptor = Object.getOwnPropertyDescriptor(pattern, "type");
  if (typeDescriptor && (!typeDescriptor.enumerable || !Object.hasOwn(typeDescriptor, "value"))) return null;
  const type = typeDescriptor ? typeDescriptor.value : null;
  const eventCount = readDataProperty(pattern, "eventCount");
  const totalOccurrences = readDataProperty(pattern, "totalOccurrences");
  const sessionCount = readDataProperty(pattern, "sessionCount");
  const evidenceRefsValue = readDataProperty(pattern, "evidenceRefs");

  if (!isIdentifier(harness) || !isIdentifier(code) || (type !== null && !isIdentifier(type))) return null;
  if (!isPositiveSafeInteger(eventCount) || !isPositiveSafeInteger(totalOccurrences) || !isPositiveSafeInteger(sessionCount)) return null;
  const evidenceRefs = readEvidenceRefs(evidenceRefsValue);
  if (evidenceRefs === null) return null;
  return { harness, code, type, eventCount, totalOccurrences, sessionCount, evidenceRefs };
}

function makeProposal(pattern, targetKind) {
  const patternKey = makePatternKey(pattern.harness, pattern.code, pattern.type);
  return {
    id: makeId(patternKey),
    harness: pattern.harness,
    code: pattern.code,
    type: pattern.type,
    eventCount: pattern.eventCount,
    totalOccurrences: pattern.totalOccurrences,
    sessionCount: pattern.sessionCount,
    evidenceRefs: pattern.evidenceRefs,
    diagnosis: makeDiagnosis(pattern.eventCount, pattern.totalOccurrences, pattern.sessionCount),
    status: "pending",
    origin: { source: "detectRecurrentFailures", patternKey },
    target: { kind: targetKind, detail: null },
  };
}

export function buildProposals(patterns, options) {
  if (!Array.isArray(patterns)) throw new TypeError("patterns must be an array.");
  if (!isPlainObject(options)) throw new TypeError("options must be an object.");
  const targetKind = readDataProperty(options, "targetKind");
  if (!TARGET_KINDS.has(targetKind)) throw new TypeError("options.targetKind must be agent, prompt, or skill.");

  const proposals = [];
  for (let index = 0; index < patterns.length; index += 1) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(patterns, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) continue;
      const pattern = inspectPattern(descriptor.value);
      if (pattern !== null) proposals.push(makeProposal(pattern, targetKind));
    } catch {
      continue;
    }
  }
  return proposals;
}

function isValidProposal(proposal) {
  if (!isPlainObject(proposal) || !hasExactKeys(proposal, PROPOSAL_KEYS)) return false;
  const harness = readDataProperty(proposal, "harness");
  const code = readDataProperty(proposal, "code");
  const type = readDataProperty(proposal, "type");
  if (!isIdentifier(harness) || !isIdentifier(code) || (type !== null && !isIdentifier(type))) return false;

  const eventCount = readDataProperty(proposal, "eventCount");
  const totalOccurrences = readDataProperty(proposal, "totalOccurrences");
  const sessionCount = readDataProperty(proposal, "sessionCount");
  const evidenceRefs = readEvidenceRefs(readDataProperty(proposal, "evidenceRefs"), true);
  const origin = readDataProperty(proposal, "origin");
  const target = readDataProperty(proposal, "target");
  const patternKey = makePatternKey(harness, code, type);

  return isPositiveSafeInteger(eventCount)
    && isPositiveSafeInteger(totalOccurrences)
    && isPositiveSafeInteger(sessionCount)
    && evidenceRefs !== null
    && typeof readDataProperty(proposal, "id") === "string"
    && readDataProperty(proposal, "id") === makeId(patternKey)
    && readDataProperty(proposal, "diagnosis") === makeDiagnosis(eventCount, totalOccurrences, sessionCount)
    && readDataProperty(proposal, "status") === "pending"
    && isPlainObject(origin)
    && hasExactKeys(origin, ["source", "patternKey"])
    && readDataProperty(origin, "source") === "detectRecurrentFailures"
    && readDataProperty(origin, "patternKey") === patternKey
    && isPlainObject(target)
    && hasExactKeys(target, ["kind", "detail"])
    && TARGET_KINDS.has(readDataProperty(target, "kind"))
    && readDataProperty(target, "detail") === null;
}

export function reviewProposal(proposal, action) {
  if (!REVIEW_ACTIONS.has(action)) throw new TypeError("action must be approve or reject.");
  if (!isValidProposal(proposal)) throw new TypeError("proposal must be a valid pending proposal.");

  return {
    id: readDataProperty(proposal, "id"),
    harness: readDataProperty(proposal, "harness"),
    code: readDataProperty(proposal, "code"),
    type: readDataProperty(proposal, "type"),
    eventCount: readDataProperty(proposal, "eventCount"),
    totalOccurrences: readDataProperty(proposal, "totalOccurrences"),
    sessionCount: readDataProperty(proposal, "sessionCount"),
    evidenceRefs: readEvidenceRefs(readDataProperty(proposal, "evidenceRefs"), true),
    diagnosis: readDataProperty(proposal, "diagnosis"),
    status: action === "approve" ? "approved" : "rejected",
    origin: {
      source: readDataProperty(readDataProperty(proposal, "origin"), "source"),
      patternKey: readDataProperty(readDataProperty(proposal, "origin"), "patternKey"),
    },
    target: {
      kind: readDataProperty(readDataProperty(proposal, "target"), "kind"),
      detail: null,
    },
  };
}
