"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

// Minimal DOM harness exercises the actual script's state, event handlers, and SVG.
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: "0", textContent: "", innerHTML: "", attributes: {}, listeners: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; }
  });
  return elements.get(id);
}
const modes = ["biaxial", "uniaxial"].map(value => ({ ...element(value), value, checked: value === "biaxial" }));
element("strain-form").querySelectorAll = () => modes;
let events = 0;
const window = { dispatchEvent(event) {
  assert.equal(event.type, "strainchange");
  assert.equal(event.detail, window.strainState);
  events++;
} };
const context = vm.createContext({
  window, document: { getElementById: element },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
});
vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);
const initialState = window.strainState;
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
assert.equal(initialState.mode, "biaxial");
assert.equal(initialState.magnitude, 0);
const referenceSvg = element("reference-cell").innerHTML;
const initialAtoms = element("lattice-atoms").innerHTML;
assert.equal((initialAtoms.match(/<circle/g) || []).length, 18);
assert.equal((element("lattice-bonds").innerHTML.match(/<line/g) || []).length, 16);
assert.equal((referenceSvg.match(/<line/g) || []).length, 12);

for (const mode of modes) {
  mode.checked = true;
  mode.listeners.change();
  for (let tick = -20; tick <= 20; tick++) {
    const percentage = tick / 10;
    const magnitude = percentage / 100;
    element("strain-magnitude").value = String(percentage);
    element("strain-magnitude").listeners.input();
    const state = window.strainState;
    assert.equal(state, initialState, "Shared object identity must remain stable");
    assert.equal(state.mode, mode.value);
    close(state.magnitude, magnitude);
    close(state.epsilonXX, magnitude);
    close(state.epsilonYY, mode.value === "biaxial" ? magnitude : -.28 * magnitude);
    close(state.epsilonZZ, mode.value === "biaxial" ? -2 * .28 / .72 * magnitude : -.28 * magnitude);
    assert.equal(element("strain-kind").textContent, tick > 0 ? "Tensile" : tick < 0 ? "Compressive" : "Unstrained");
    assert.equal(element("magnitude-output").value, `${percentage.toFixed(1)}%`);
    assert.equal(element("reference-cell").innerHTML, referenceSvg, "Reference must never deform");
    const svg = element("lattice-atoms").innerHTML;
    assert(!/NaN|Infinity/.test(svg));
    for (const match of svg.matchAll(/c([xy])="([^"]+)"/g)) {
      const limit = match[1] === "x" ? 440 : 240;
      assert(Number(match[2]) >= 5 && Number(match[2]) <= limit - 5, "Lattice must fit SVG viewBox");
    }
    if (tick !== 0) assert.notEqual(svg, initialAtoms);
    else assert.equal(svg, initialAtoms);
  }
}
let prevented = false;
element("strain-form").listeners.reset({ preventDefault() { prevented = true; } });
assert(prevented);
assert.equal(window.strainState, initialState);
assert.equal(initialState.mode, "biaxial");
for (const key of ["magnitude", "epsilonXX", "epsilonYY", "epsilonZZ"]) assert.equal(initialState[key], 0);
assert(modes[0].checked && !modes[1].checked);
assert.equal(element("lattice-atoms").innerHTML, initialAtoms);
assert.equal(element("epsilon-zz").value, "0.000%");
for (const magnitude of [NaN, Infinity, -.021, .021]) assert.throws(() => context.calculateStrain(magnitude, "biaxial"));
assert.throws(() => context.calculateStrain(0, "invalid"));

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(html, /min="-2" max="2" step="0.1"/);
assert.equal((html.match(/class="panel surface"/g) || []).length, 4);
assert(!/will appear here|Reserved for/.test(html));
const zero = context.calculateElectronModel(initialState);
zero.populations.forEach(p => close(p, 1/3));
zero.ratios.forEach(r => close(r, 1));
close(zero.splitting, 0);
for (const mode of ['biaxial', 'uniaxial']) {
  for (let tick = -20; tick <= 20; tick++) {
    for (const temperature of [100, 300, 600]) {
      for (const transportAxis of ['x', 'y', 'z']) {
        const state = { ...context.calculateStrain(tick / 1000, mode), temperature, transportAxis };
        const model = context.calculateElectronModel(state);
        close(model.energies.reduce((a,b)=>a+b,0), 0);
        close(model.populations.reduce((a,b)=>a+b,0), 1);
        model.populations.forEach(p => assert(p >= 0 && p <= 1));
        model.masses.forEach(m => assert(m >= .191 - 1e-12 && m <= .903 + 1e-12));
        model.ratios.forEach(r => assert(Number.isFinite(r) && r > 0));
        for (let i=0;i<3;i++) for (let j=0;j<3;j++) {
          if (model.energies[i] < model.energies[j]) assert(model.populations[i] >= model.populations[j]);
        }
        if (mode === 'biaxial') close(model.populations[0], model.populations[1]);
        else close(model.populations[1], model.populations[2]);
        for (let valley=0; valley<3; valley++) {
          close(context.bandEnergy(model.energies[valley], 0, valley, 0), model.energies[valley]);
          close(context.bandEnergy(model.energies[valley], .2, valley, 0), context.bandEnergy(model.energies[valley], -.2, valley, 0));
        }
        for (const ratio of model.ratios) {
          close(context.normalizedCurrent(0, ratio), 0);
          close(context.normalizedCurrent(1, ratio), ratio);
          close(context.normalizedCurrent(1.5, ratio), ratio);
          assert(context.normalizedCurrent(.5, ratio) < ratio);
        }
      }
    }
  }
}
const tension = context.calculateElectronModel({ ...context.calculateStrain(.01, 'biaxial'), temperature: 300, transportAxis: 'x' });
assert(tension.populations[2] > tension.populations[0]);
assert(tension.ratios[0] > 1 && tension.ratios[2] < 1);
const cold = context.calculateElectronModel({ ...context.calculateStrain(.001, 'biaxial'), temperature: 100, transportAxis: 'x' });
const hot = context.calculateElectronModel({ ...context.calculateStrain(.001, 'biaxial'), temperature: 600, transportAxis: 'x' });
assert(cold.populations[2] > hot.populations[2]);
element('temperature').value='600'; element('temperature').listeners.change();
assert.equal(initialState.temperature,600);
element('temperature').value=''; element('temperature').listeners.change();
assert.equal(initialState.temperature,600);
element('transport-axis').value='z'; element('transport-axis').listeners.change();
assert.equal(initialState.transportAxis,'z');
element('strain-form').listeners.reset({preventDefault(){}});
assert.equal(initialState.temperature,300);
assert.equal(initialState.transportAxis,'x');
assert.equal(element('mobility-ratio').textContent,'1.000×');
for (const name of ['valley-drawing','band-drawing','device-drawing']) assert(!/NaN|Infinity|undefined/.test(element(name).innerHTML));
for (const bad of [0, NaN, 601]) assert.throws(()=>context.calculateElectronModel({...initialState,temperature:bad}));
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size);
for(const match of html.matchAll(/(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)) for(const id of match[1].split(' ')) assert(ids.includes(id), id);
console.log('Passed: 738 electron-model cases, valley symmetry and ordering, mass bounds, thermal populations, local bands, nMOS curves, temperature/direction controls, and complete reset.');
console.log(`Passed: both modes at all 41 slider values, tensor formulas, SVG bounds/topology, shared state, reset, and ${events} change events.`);

assert.match(html, /lang="en"/);
assert(!/[\u3400-\u9fff]/.test(html + fs.readFileSync(path.join(root,'script.js'),'utf8')), 'Interface must be English');
assert(!/nano-lesson|valence-note|nano-volume/.test(html), 'Off-topic bottom sections removed');
