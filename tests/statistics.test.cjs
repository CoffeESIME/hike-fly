const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Compile the actual source in memory; no generated test build or extra runtime dependencies.
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { parseGpxFeatureCollection, buildElevationProfile, summarizeProfile, metricAtDistance, routePointAtDistance, routeSegments } = require('../app/utils/gpxUtils.ts');
const { statisticsAtDistance, DEFAULT_STATISTICS, manualDuration, formatDuration } = require('../app/utils/statistics.ts');
const line = (coordinates, times) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { name: 'Test', coordinateProperties: { times } } });
const route = (...features) => parseGpxFeatureCollection({ type: 'FeatureCollection', features });
const at = i => `2026-01-01T0${i}:00:00Z`;
const settings = { ...DEFAULT_STATISTICS, elevationThreshold: 0 };
const item = (items, key) => items.find(i => i.key === key);

test('raw ascent, descent and live gain follow the actual hills, not proportional distance', () => {
  const profile = buildElevationProfile(route(line([[0,0,100], [0.01,0,200], [0.02,0,150], [0.03,0,180]], [at(0),at(1),at(2),at(3)])), 0);
  const totals = summarizeProfile(profile);
  assert.equal(totals.gain, 130); assert.equal(totals.loss, 50);
  assert.equal(totals.min, 100); assert.equal(totals.max, 200); assert.equal(totals.duration, 10800);
  assert.equal(metricAtDistance(profile, profile[1].dist / 2, 'gain'), 50);
  assert.equal(metricAtDistance(profile, (profile[1].dist + profile[2].dist) / 2, 'gain'), 100);
  assert.equal(item(statisticsAtDistance(profile, settings, 0), 'gain').value, '0');
  assert.equal(item(statisticsAtDistance(profile, settings, totals.distance, true), 'gain').value, '130');
});

test('missing elevation is unavailable, not zero, and never creates an ascent', () => {
  const profile = buildElevationProfile(route(line([[0,0,100], [0.01,0], [0.02,0,200]])), 0);
  assert.equal(summarizeProfile(profile).gain, null);
  assert.equal(summarizeProfile(profile).max, null);
  assert.equal(profile.at(-1).gain, 0);
  assert.equal(metricAtDistance(profile, profile[1].dist, 'ele'), null);
  assert.equal(item(statisticsAtDistance(profile, settings, profile[1].dist), 'gain').value, '—');
});

test('segment gaps add neither horizontal distance nor elevation; sampling skips the gap', () => {
  const r = route(line([[0,0,0], [0.01,0,10]]), line([[10,0,1000], [10.01,0,1020]]));
  const p = buildElevationProfile(r, 0), summary = summarizeProfile(p);
  assert.ok(summary.distance > 2200 && summary.distance < 2230);
  assert.equal(summary.gain, 30); assert.equal(p[1].dist, p[2].dist);
  assert.deepEqual(routePointAtDistance(p, p[1].dist).geometry.coordinates, [10,0,1000]);
  assert.equal(routeSegments(r).length, 2);
});

test('MultiLineString preserves aligned timestamps and names; null geometries are ignored', () => {
  const f = { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[0,0,0],[0.01,0,10]], [[1,0,50],[1.01,0,60]]] }, properties: { name: 'Dos segmentos', coordinateProperties: { times: [[at(0),at(1)],[at(2),at(3)]] } } };
  const r = route({type:'Feature',geometry:null,properties:{}}, f);
  assert.equal(r.properties.name, 'Dos segmentos'); assert.deepEqual(r.properties.segmentStarts, [0,2]);
  assert.equal(summarizeProfile(buildElevationProfile(r)).duration, 10800);
});

test('missing, compacted or reversed timestamps never fabricate a duration', () => {
  for (const times of [[at(0),null,at(2)], [at(0),at(2)], [at(2),at(1),at(0)], [at(0),'bad',at(2)]]) {
    const p = buildElevationProfile(route(line([[0,0],[0.01,0],[0.02,0]], times)));
    assert.equal(summarizeProfile(p).duration, null);
    assert.equal(item(statisticsAtDistance(p, settings, 0, true), 'duration').value, '—');
  }
});

test('noise filter reduces repeated GPS jitter without dropping a gradual climb', () => {
  const noisy = route(line([100,101,100,101,100,101,100].map((z,i) => [i/100,0,z])));
  assert.equal(summarizeProfile(buildElevationProfile(noisy, 0)).gain, 3);
  assert.equal(summarizeProfile(buildElevationProfile(noisy, 3)).gain, 0);
  const gradual = route(line([100,101,102,103,104,105].map((z,i) => [i/100,0,z])));
  assert.equal(summarizeProfile(buildElevationProfile(gradual, 3)).gain, 5);
});

test('manual totals and static automatic modes stay fixed across playback and completion', () => {
  const p = buildElevationProfile(route(line([[0,0,100],[.01,0,200]], [at(0),at(1)])), 0);
  const manual = {...settings, elevationSource:'manual', manualGain:'850', durationSource:'manual', manualHours:'2', manualMinutes:'30'};
  for (const d of [0, p.at(-1).dist / 2, p.at(-1).dist]) {
    assert.equal(item(statisticsAtDistance(p, manual, d), 'gain').value, '850');
    assert.equal(item(statisticsAtDistance(p, manual, d), 'duration').value, '2 h 30 min');
    assert.equal(item(statisticsAtDistance(p, {...settings,liveElevation:false}, d), 'gain').value, '100');
  }
  assert.equal(item(statisticsAtDistance(p, manual, 0, true), 'gain').value, '850');
});

test('invalid manual inputs, zero gain and hour formatting', () => {
  assert.equal(manualDuration({...settings, manualHours:'1', manualMinutes:'60'}), null);
  assert.equal(manualDuration({...settings, manualHours:'-1', manualMinutes:'0'}), null);
  assert.equal(manualDuration({...settings, manualHours:'.5', manualMinutes:'0'}), null);
  assert.equal(manualDuration(settings), null);
  assert.equal(manualDuration({...settings, manualHours:'0', manualMinutes:'30'}), 1800);
  assert.equal(formatDuration(3660), '1 h 01 min');
  assert.equal(item(statisticsAtDistance([], {...settings,elevationSource:'manual',manualGain:'0'},0), 'gain').value, '0');
  assert.equal(item(statisticsAtDistance([], {...settings,elevationSource:'manual',manualGain:'-2'},0), 'gain').value, '—');
});

test('duplicate points, below-sea-level elevations and large profiles stay finite', () => {
  const p = buildElevationProfile(route(line([[0,0,-20],[0,0,-20],[.01,0,-10]])));
  assert.equal(summarizeProfile(p).min, -20);
  assert.ok(Number.isFinite(metricAtDistance(p,0,'gain')));
  assert.equal(metricAtDistance(p,Infinity,'gain'),10);
  const large = Array.from({length:150000}, (_,i) => ({dist:i,ele:i%100,gain:i,loss:0,elapsed:null,coordinate:[0,0]}));
  assert.equal(summarizeProfile(large).max,99);
});

test('invalid coordinates and routes with no usable geometry are rejected', () => {
  assert.throws(() => route(line([[181,0],[0,0]])), /fuera de rango/);
  assert.throws(() => route(), /dos puntos/);
});
