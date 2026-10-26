import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("starter project is documentation-only and dependency-free", async () => {
  const manifest = JSON.parse(await readProjectFile("package.json"));
  assert.equal(manifest.scripts?.test, "node --test");
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);

  const readme = await readProjectFile("README.md");
  const architecture = await readProjectFile("docs/architecture.md");
  const attributions = await readProjectFile("docs/attributions.md");
  const priorWork = await readProjectFile("docs/prior-work.md");
  for (const document of [readme, architecture, attributions, priorWork]) {
    assert.ok(document.trim().length > 0);
  }

  assert.match(architecture, /aprobación humana explícita/iu);
  assert.match(architecture, /datos sintéticos/iu);
  assert.match(attributions, /No se incorporan código, archivos ni historial/iu);
  assert.match(priorWork, /sigue siendo un borrador/iu);

  const workflow = await readProjectFile(".github/workflows/ci.yml");
  for (const runner of ["windows-latest", "ubuntu-latest", "macos-latest"]) {
    assert.ok(workflow.includes(runner), `CI runner missing: ${runner}`);
  }
  assert.match(workflow, /node-version:\s*22/u);
  assert.match(workflow, /run:\s*npm test/u);
});
