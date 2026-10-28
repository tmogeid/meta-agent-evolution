import test from "node:test";

// Test opcional con red real. SKIP por defecto SIEMPRE: requiere autorización
// explícita adicional e incluso con env API key presente NO ejecuta red.
// Para habilitarlo en el futuro se exigirá META_REAL_TEST=1 + revisión aparte.
// Nunca ejecutar con cargo: sin autorización no hay llamada con pago.

const REAL_ENABLED = process.env.META_REAL_TEST === "1";

test("meta real contra OmniRoute (requiere autorización explícita)", { skip: !REAL_ENABLED }, async (t) => {
  t.skip("SKIP por defecto: sin autorización explícita adicional no hay red ni cargo.");
});
