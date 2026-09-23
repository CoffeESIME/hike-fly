const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { elevationChartAvailability, buildElevationChart, elevationChartCursor } = require('../app/utils/elevationChart.ts');
const p = (dist, ele) => ({dist, ele, gain:0, loss:0, elapsed:null, coordinate:[0,0]});

test('chart skips incomplete elevations, invalid distances and zero-length routes', () => {
  for (const profile of [[], [p(0,20)], [p(0,20),p(1,null)], [p(0,NaN),p(1,20)], [p(0,20),p(1,Infinity)], [p(0,20),p(0,20)], [p(0,20),p(2,30),p(1,20)], [p(1,20),p(2,30)], [p(0,20),p(Infinity,20)]]) {
    assert.ok(elevationChartAvailability(profile));
    assert.equal(buildElevationChart(profile,[0]),null);
  }
});

test('flat routes and below-sea-level routes produce finite paths', () => {
  for (const elevations of [[0,0],[-50,-30]]) {
    const profile=elevations.map((ele,i)=>p(i*100,ele));
    const chart=buildElevationChart(profile,[0]);
    assert.ok(chart); assert.equal(elevationChartAvailability(profile),null);
    assert.ok(!/NaN|Infinity/.test(chart.lines.join('')));
    const cursor=elevationChartCursor(profile,chart,50);
    assert.equal(cursor.elevation,(elevations[0]+elevations[1])/2);
    if(elevations[0]===elevations[1]) assert.equal(cursor.y,48);
  }
});

test('cursor follows original samples, clamps bounds and returns to the beginning on reset', () => {
  const profile=[p(0,100),p(100,200),p(300,150)];
  const chart=buildElevationChart(profile,[0]);
  assert.equal(elevationChartCursor(profile,chart,50).elevation,150);
  assert.equal(elevationChartCursor(profile,chart,200).elevation,175);
  assert.equal(elevationChartCursor(profile,chart,300).x,1000);
  assert.equal(elevationChartCursor(profile,chart,900).distance,300);
  assert.equal(elevationChartCursor(profile,chart,-5).distance,0);
  assert.deepEqual(elevationChartCursor(profile,chart,0),{x:0,y:86,elevation:100,distance:0});
});

test('segment boundaries are separate paths and duplicate distances never divide by zero', () => {
  const profile=[p(0,10),p(100,20),p(100,90),p(200,100)];
  const chart=buildElevationChart(profile,[0,2]);
  assert.equal(chart.lines.length,2); assert.equal(chart.areas.length,2);
  assert.equal(elevationChartCursor(profile,chart,100).elevation,90);
  assert.ok(chart.lines.every(line=>line.startsWith('M')));
});

test('large tracks retain narrow peaks and valleys while bounding SVG size', () => {
  const profile=Array.from({length:150000},(_,i)=>p(i,50));
  profile[55555].ele=1000; profile[55556].ele=-100;
  const chart=buildElevationChart(profile,[0]);
  assert.equal(chart.min,-100); assert.equal(chart.max,1000);
  assert.ok(chart.lines[0].includes(',10.00'));
  assert.ok(chart.lines[0].includes(',86.00'));
  assert.ok(chart.lines[0].split(' ').length<=4004);
  assert.equal(elevationChartCursor(profile,chart,55555).elevation,1000);
});
