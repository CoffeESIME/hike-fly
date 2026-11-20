const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { cameraPoseAtProgress } = require('../app/utils/cameraPresets.ts');

const pose = (preset, progress) => cameraPoseAtProgress(preset, progress, 175, 60, 800, 280);

test('classic retains the original orbit and camera settings for the entire route', () => {
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    assert.deepEqual(pose('classic', progress), { bearing: 175 - progress * 280, pitch: 60, altitude: 800 });
  }
});

test('sweep holds opposite angles and returns to the opening shot', () => {
  const opening = pose('sweep', 0);
  assert.deepEqual(pose('sweep', 0.15), opening);
  assert.equal(pose('sweep', 0.5).bearing, opening.bearing + 90);
  assert.deepEqual(pose('sweep', 0.6), pose('sweep', 0.5));
  assert.deepEqual(pose('sweep', 1), opening);
});

test('panorama rises into a steeper overhead view then closes from a new angle', () => {
  const opening = pose('panorama', 0), middle = pose('panorama', 0.5), closing = pose('panorama', 1);
  assert.ok(middle.altitude > opening.altitude && middle.pitch < opening.pitch);
  assert.ok(opening.bearing < middle.bearing && middle.bearing < closing.bearing);
  assert.equal(closing.altitude, opening.altitude);
  assert.equal(closing.pitch, opening.pitch);
});

test('automatic camera moves stay continuous across shot boundaries and the bearing wrap', () => {
  for (const preset of ['sweep', 'panorama']) {
    let previous = pose(preset, 0);
    for (let frame = 1; frame <= 1000; frame++) {
      const current = pose(preset, frame / 1000);
      assert.ok(Math.abs(current.bearing - previous.bearing) < 1);
      assert.ok(Math.abs(current.pitch - previous.pitch) < 1);
      assert.ok(Math.abs(current.altitude - previous.altitude) < 5);
      previous = current;
    }
  }
});
