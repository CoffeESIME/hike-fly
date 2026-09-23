const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { playRouteOverview } = require('../app/utils/routeOverview.ts');

function camera(immediate = false) {
  const listeners = new Set();
  return {
    on: (_, fn) => listeners.add(fn),
    off: (_, fn) => listeners.delete(fn),
    emit(event = {}) { for (const fn of [...listeners]) fn(event); },
    stop() { this.emit(); },
    getContainer: () => ({ clientWidth: 390, clientHeight: 844 }),
    fitBounds(bounds, options, event) {
      this.bounds = bounds; this.options = options; this.event = event;
      if (immediate) this.emit(event);
    },
  };
}
const coordinates = [[-99, 19], [-100, 20], [-98, 18]];

test('summary waits for its own overview to finish and fits every route point', () => {
  const map = camera(); let completed = 0;
  playRouteOverview(map, coordinates, () => completed++);
  assert.equal(completed, 0);
  assert.deepEqual(map.bounds, [-100, 18, -98, 20]);
  assert.ok(map.options.padding < 390 / 2);
  map.emit(); // An unrelated camera event must not open the summary.
  assert.equal(completed, 0);
  map.emit(map.event);
  map.emit(map.event);
  assert.equal(completed, 1);
});

test('reset, route replacement or unmount cancels a pending summary', () => {
  const map = camera(); let completed = 0;
  const cancel = playRouteOverview(map, coordinates, () => completed++);
  const oldEvent = map.event;
  cancel();
  playRouteOverview(map, coordinates, () => completed++);
  map.emit(oldEvent);
  assert.equal(completed, 0);
  map.emit(map.event);
  assert.equal(completed, 1);
});

test('immediate camera completion (reduced motion) still opens the summary once', () => {
  const map = camera(true); let completed = 0;
  const cancel = playRouteOverview(map, coordinates, () => completed++);
  assert.equal(completed, 1);
  cancel(); map.emit(map.event);
  assert.equal(completed, 1);
});
