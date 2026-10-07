"use strict";

// Phase 1 approximation: isotropic small-strain linear elasticity with nu = 0.28.
// This representative silicon value is not an orientation-dependent elastic model.
// Reference: Hopcroft et al., What is the Young's Modulus of Silicon? (2010)
// https://mems.stanford.edu/~hopcroft/Publications/Hopcroft_Youngs_Modulus_Silicon.pdf
// Biaxial: imposed equal x/y strains, sigmaZZ = 0 (free surface), so
// epsilonZZ = -2 * nu / (1 - nu) * magnitude, NOT simply -nu * magnitude.
// Uniaxial: imposed x strain, sigmaYY = sigmaZZ = 0 (free transverse surfaces),
// so epsilonYY = epsilonZZ = -nu * magnitude. All shear components are zero.
const SILICON_POISSON_RATIO = 0.28;
const VISUAL_EXAGGERATION = 12; // Rendering only. Never used to calculate strain.

// Shared state uses dimensionless strain: 0.02 means 2%, not 0.02%.
// Keep object identity stable so later panels can hold a reference to this object.
const strainState = { magnitude: 0, mode: "biaxial", epsilonXX: 0, epsilonYY: 0, epsilonZZ: 0, temperature: 300, transportAxis: "x" };
window.strainState = strainState;

function calculateStrain(magnitude, mode) {
  if (!Number.isFinite(magnitude) || Math.abs(magnitude) > 0.02) {
    throw new RangeError("Strain must be a finite fraction between -0.02 and 0.02.");
  }
  if (mode !== "biaxial" && mode !== "uniaxial") throw new TypeError("Unknown strain mode.");
  const transverse = magnitude === 0 ? 0 : -SILICON_POISSON_RATIO * magnitude;
  return {
    magnitude, mode,
    epsilonXX: magnitude,
    epsilonYY: mode === "biaxial" ? magnitude : transverse,
    epsilonZZ: mode === "biaxial" && magnitude !== 0
      ? -2 * SILICON_POISSON_RATIO / (1 - SILICON_POISSON_RATIO) * magnitude : transverse
  };
}

const byId = (id) => document.getElementById(id);
const strainForm = byId("strain-form");
const magnitudeInput = byId("strain-magnitude");
const modeInputs = strainForm.querySelectorAll('input[name="mode"]');
const percent = (value, digits) => `${(Math.abs(value) < 1e-10 ? 0 : value * 100).toFixed(digits)}%`;

// Conventional diamond-cubic cell: FCC sites plus the (1/4,1/4,1/4) basis.
// Fractional coordinates, schematic unit size; boundary atoms are shared cells.
const corners = [];
for (let x = 0; x <= 1; x++) for (let y = 0; y <= 1; y++) for (let z = 0; z <= 1; z++) corners.push([x, y, z]);
const atoms = [...corners,
  [0, .5, .5], [1, .5, .5], [.5, 0, .5], [.5, 1, .5], [.5, .5, 0], [.5, .5, 1],
  [.25, .25, .25], [.25, .75, .75], [.75, .25, .75], [.75, .75, .25]
];
const edges = [];
const bonds = [];
corners.forEach((a, i) => corners.forEach((b, j) => {
  if (j > i && a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0) === 1) edges.push([i, j]);
}));
atoms.forEach((a, i) => atoms.forEach((b, j) => {
  const distanceSquared = a.reduce((sum, v, k) => sum + (v - b[k]) ** 2, 0);
  if (j > i && Math.abs(distanceSquared - 3 / 16) < 1e-10) bonds.push([i, j]);
}));

function project(point, tensor, exaggeration) {
  const [x, y, z] = point.map((value, i) => (value - .5) * (1 + exaggeration * tensor[i]));
  return [220 + 130 * x - 65 * y, 124 - 48 * y - 100 * z];
}
const line = (a, b) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;

function renderLattice() {
  const tensor = [strainState.epsilonXX, strainState.epsilonYY, strainState.epsilonZZ];
  const points = atoms.map((point) => project(point, tensor, VISUAL_EXAGGERATION));
  const reference = corners.map((point) => project(point, [0, 0, 0], 1));
  byId("reference-cell").innerHTML = edges.map(([a, b]) => line(reference[a], reference[b])).join("");
  byId("lattice-cell").innerHTML = edges.map(([a, b]) => line(points[a], points[b])).join("");
  byId("lattice-bonds").innerHTML = bonds.map(([a, b]) => line(points[a], points[b])).join("");
  // Depth order reduces overlap ambiguity; atom radii stay constant during strain.
  byId("lattice-atoms").innerHTML = atoms.map((point, i) => ({ point, i }))
    .sort((a, b) => b.point[1] - a.point[1])
    .map(({ i }) => `<circle cx="${points[i][0]}" cy="${points[i][1]}" r="${i < 14 ? 4 : 4.8}" class="${i < 14 ? 'atom-fcc' : 'atom-basis'}"/>`).join("");
  const origin = [42, 202];
  byId("lattice-axes").innerHTML = [["x", [77, 202]], ["y", [21, 186]], ["z", [42, 167]]]
    .map(([label, end]) => line(origin, end) + `<text x="${end[0] + 4}" y="${end[1] - 4}">${label}</text>`).join("");
  byId("lattice-svg-description").textContent = `${byId("strain-kind").textContent}, ${strainState.mode}, applied strain ${percent(strainState.magnitude, 1)}. Diamond-cubic lattice with display deformation exaggerated ${VISUAL_EXAGGERATION} times. Dashed outline shows the unstrained cell.`;
}

function updateStrain(magnitude, mode) {
  Object.assign(strainState, calculateStrain(magnitude, mode));
  magnitudeInput.value = (strainState.magnitude * 100).toFixed(1);
  byId("magnitude-output").value = percent(strainState.magnitude, 1);
  magnitudeInput.setAttribute("aria-valuetext", percent(strainState.magnitude, 1));
  modeInputs.forEach((input) => { input.checked = input.value === mode; });
  byId("epsilon-xx").value = percent(strainState.epsilonXX, 3);
  byId("epsilon-yy").value = percent(strainState.epsilonYY, 3);
  byId("epsilon-zz").value = percent(strainState.epsilonZZ, 3);
  byId("strain-kind").textContent = magnitude > 0 ? "Tensile" : magnitude < 0 ? "Compressive" : "Unstrained";
  byId("strain-mode").textContent = mode === "biaxial" ? "Biaxial" : "Uniaxial";
  byId("model-description").textContent = mode === "biaxial"
    ? "In-plane x / y strain; free out-of-plane response. Shear = 0."
    : "Applied x strain; free transverse y / z response. Shear = 0.";
  renderLattice();
  renderPhysics();
  // Future panels may read window.strainState and subscribe to this event.
  window.dispatchEvent(new CustomEvent("strainchange", { detail: strainState }));
}

magnitudeInput.addEventListener("input", () => updateStrain(Number(magnitudeInput.value) / 100, strainState.mode));
modeInputs.forEach((input) => input.addEventListener("change", () => {
  if (input.checked) updateStrain(strainState.magnitude, input.value);
}));
strainForm.addEventListener("reset", (event) => {
  event.preventDefault(); // Reset synchronously; no native-reset/render race.
  strainState.temperature = 300;
  strainState.transportAxis = "x";
  byId("temperature").value = "300";
  byId("transport-axis").value = "x";
  updateStrain(0, "biaxial");
});
strainForm.addEventListener("submit", (event) => event.preventDefault());

// Educational conduction-band model; all energies are relative to the valley mean.
// Xi_u = 9.16 eV: Wang et al., PRB 83, 195318 (2011), parameter discussion.
// Fixed parabolic masses: Smirnov, TU Wien, section 2.4.2.3 (Delta valleys).
// Equal +/- pair degeneracies cancel in the Boltzmann normalization.
const ELECTRON_MODEL = Object.freeze({ xiU: 9.16, massL: .903, massT: .191, kB: 8.617333262e-5, hbar2Over2M0: .03809982, k0: .85 });
const AXES = ["x", "y", "z"];
const COLORS = ["#087a73", "#356fc0", "#b35b16"];
const DASHES = ["", "7 3", "2 3"];

function calculateElectronModel(state) {
  if (!Number.isFinite(state.temperature) || state.temperature < 100 || state.temperature > 600) throw new RangeError("Temperature must be 100–600 K.");
  if (!AXES.includes(state.transportAxis)) throw new TypeError("Unknown transport axis.");
  const tensor = [state.epsilonXX, state.epsilonYY, state.epsilonZZ];
  const mean = tensor.reduce((a, b) => a + b, 0) / 3;
  const energies = tensor.map(e => ELECTRON_MODEL.xiU * (e - mean));
  const minimum = Math.min(...energies);
  // Subtract minimum to avoid numerical overflow in thermal weights.
  const weights = energies.map(e => Math.exp(-(e - minimum) / (ELECTRON_MODEL.kB * state.temperature)));
  const total = weights.reduce((a, b) => a + b, 0);
  const populations = weights.map(w => w / total);
  const inverseMasses = AXES.map((_, direction) => populations.reduce((sum, p, valley) => sum + p / (valley === direction ? ELECTRON_MODEL.massL : ELECTRON_MODEL.massT), 0));
  const baselineInverseMass = (1 / ELECTRON_MODEL.massL + 2 / ELECTRON_MODEL.massT) / 3;
  return { energies, populations, masses: inverseMasses.map(m => 1 / m), ratios: inverseMasses.map(m => m / baselineInverseMass), splitting: Math.max(...energies) - minimum };
}
function bandEnergy(energyEdge, q, valley, direction) {
  return energyEdge + ELECTRON_MODEL.hbar2Over2M0 * q * q / (valley === direction ? ELECTRON_MODEL.massL : ELECTRON_MODEL.massT);
}
function normalizedCurrent(v, mobilityRatio) {
  return mobilityRatio * (v <= 1 ? 2 * v - v * v : 1);
}
const svgText = (x, y, text, anchor = "start") => `<text x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;
function plotPath(fn, xmin, xmax, ymin, ymax, height = 200) {
  const left = 58, right = 425, top = 15, bottom = height - 34;
  const points = Array.from({ length: 81 }, (_, i) => {
    const x = xmin + (xmax - xmin) * i / 80;
    return `${left + (right - left) * i / 80},${bottom - (fn(x) - ymin) / (ymax - ymin) * (bottom - top)}`;
  });
  return `M${points.join(" L")}`;
}
function plotAxes(xmin, xmax, ymin, ymax, xlabel, ylabel, height = 200) {
  const left = 58, right = 425, top = 15, bottom = height - 34;
  let svg = `<g class="plot-grid">`;
  for (let i = 0; i <= 4; i++) {
    const y = top + (bottom - top) * i / 4;
    svg += line([left, y], [right, y]);
  }
  svg += `</g><g class="plot-labels">`;
  for (let i = 0; i <= 4; i++) {
    const y = top + (bottom - top) * i / 4;
    svg += svgText(50, y + 4, (ymax - (ymax - ymin) * i / 4).toFixed(ylabel.includes("meV") ? 0 : 1), "end");
  }
  for (let i = 0; i <= 2; i++) svg += svgText(left + (right - left) * i / 2, bottom + 15, (xmin + (xmax - xmin) * i / 2).toFixed(2), "middle");
  svg += svgText(242, height - 3, xlabel, "middle") + svgText(8, 10, ylabel) + `</g>`;
  return svg;
}

function renderValleys(model) {
  const tensor = [strainState.epsilonXX, strainState.epsilonYY, strainState.epsilonZZ];
  const vectors = [[128, 0], [-77, 43], [0, -62]];
  const center = [220, 100];
  let svg = `<g class="reciprocal-axes">`;
  vectors.forEach((v, i) => {
    svg += line([center[0] - v[0], center[1] - v[1]], [center[0] + v[0], center[1] + v[1]]);
    svg += svgText(center[0] + v[0] + 8, center[1] + v[1] + 3, `k${AXES[i]}`);
  });
  svg += svgText(228, 114, "Γ") + `</g>`;
  vectors.forEach((v, i) => {
    // Actual reciprocal scaling, no visual-exaggeration factor. Reduced k0 fixed.
    const scale = ELECTRON_MODEL.k0 / (1 + tensor[i]);
    const angle = Math.atan2(v[1], v[0]) * 180 / Math.PI;
    for (const sign of [-1, 1]) {
      const x = center[0] + sign * v[0] * scale;
      const y = center[1] + sign * v[1] * scale;
      const rx = 12 * Math.sqrt(ELECTRON_MODEL.massL / ELECTRON_MODEL.massT), ry = 12;
      svg += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${angle} ${x} ${y})" fill="${COLORS[i]}" fill-opacity="${.15 + .65 * model.populations[i]}" stroke="${COLORS[i]}" stroke-width="2"><title>${sign > 0 ? '+' : '−'}${AXES[i]}: ${(model.populations[i] * 50).toFixed(1)}% population; edge ${(model.energies[i] * 1000).toFixed(1)} meV</title></ellipse>`;
    }
  });
  byId("valley-drawing").innerHTML = svg;
  byId("valley-readouts").innerHTML = AXES.map((axis, i) => `<span style="color:${COLORS[i]}"><strong>±${axis} ${(model.populations[i] * 100).toFixed(1)}%</strong><small>${(model.energies[i] * 1000).toFixed(1)} meV</small></span>`).join("");
  byId("valley-description").textContent = AXES.map((axis, i) => `Plus/minus ${axis} pair: ${(model.populations[i] * 100).toFixed(1)} percent, relative energy ${(model.energies[i] * 1000).toFixed(1)} meV`).join(". ");
}
function renderBands(model) {
  const direction = AXES.indexOf(strainState.transportAxis);
  const qmax = .35;
  const ymin = Math.min(0, ...model.energies) * 1000 - 8;
  const ymax = Math.max(bandEnergy(0, qmax, (direction + 1) % 3, direction), ...model.energies.map((e, i) => bandEnergy(e, qmax, i, direction))) * 1000 + 8;
  let svg = plotAxes(-qmax, qmax, ymin, ymax, `q${strainState.transportAxis} about each minimum (nm⁻¹)`, "E (meV)");
  if (teachingState.compare) {
    for (const i of [0, 1, 2]) svg += '<path d="' + plotPath(q => bandEnergy(0, q, i, direction) * 1000, -qmax, qmax, ymin, ymax) + '" fill="none" stroke="#8994a8" stroke-width="1.5" stroke-dasharray="4 4"/>';
  }
  // Draw transverse curves first, then longitudinal, so zero-strain overlap is clear.
  const order = [0, 1, 2].filter(i => i !== direction).concat(direction);
  for (const i of order) svg += `<path d="${plotPath(q => bandEnergy(model.energies[i], q, i, direction) * 1000, -qmax, qmax, ymin, ymax)}" fill="none" stroke="${COLORS[i]}" stroke-width="2.2" stroke-dasharray="${DASHES[i]}"/>`;
  byId("band-drawing").innerHTML = svg;
  byId("splitting-readout").textContent = `Edge spread: ${(model.splitting * 1000).toFixed(1)} meV`;
  byId("band-description").textContent = `Parabolic local cuts along ${strainState.transportAxis}. Relative valley-edge spread ${(model.splitting * 1000).toFixed(1)} meV. Longitudinal and transverse curvature use fixed masses; this is not a full band structure.`;
}
function renderTransport(model) {
  const direction = AXES.indexOf(strainState.transportAxis);
  const ratio = model.ratios[direction];
  byId("conductivity-mass").textContent = `${model.masses[direction].toFixed(3)} m₀`;
  byId("mobility-ratio").textContent = `${ratio.toFixed(3)}×`;
  byId("transport-bars").innerHTML = AXES.map((axis, i) => `<div class="mass-row"><span>${axis}${i === direction ? ' · selected' : ''}</span><div class="ratio-track"><span style="width:${model.ratios[i] / 1.5 * 100}%;background:${COLORS[i]}"></span><i class="baseline-marker"></i></div><strong>${model.ratios[i].toFixed(3)}×</strong></div>`).join("");
  byId("transport-explanation").textContent = `Marker = unstrained (1×). Populations change conductivity mass; valley masses and τ are fixed.`;
  const change = Math.abs(ratio - 1) < 1e-10 ? 0 : (ratio - 1) * 100;
  byId("device-result").textContent = `Along ${strainState.transportAxis}: normalized saturation current ${ratio.toFixed(3)}× (${change >= 0 ? '+' : ''}${change.toFixed(1)}%) in this model.`;
  const ymax = Math.max(1, ratio) * 1.15;
  let svg = plotAxes(0, 1.5, 0, ymax, "VDS / Vov", "I / I₀,sat", 170);
  svg += `<path d="${plotPath(v => normalizedCurrent(v, 1), 0, 1.5, 0, ymax, 170)}" fill="none" stroke="#7b8b99" stroke-width="2" stroke-dasharray="5 4"/>`;
  svg += `<path d="${plotPath(v => normalizedCurrent(v, ratio), 0, 1.5, 0, ymax, 170)}" fill="none" stroke="${COLORS[direction]}" stroke-width="2.5"/>`;
  byId("device-drawing").innerHTML = svg;
  byId("device-description").textContent = `Illustrative normalized nMOS output characteristic. Current saturation is ${ratio.toFixed(3)} times the unstrained reference. Fixed gate overdrive and constant scattering time; not a calibrated device prediction.`;
}
function renderPhysics() {
  const model = calculateElectronModel(strainState);
  renderValleys(model);
  renderBands(model);
  renderTransport(model);
  renderTeaching(model);
}
byId("temperature").addEventListener("change", () => {
  const value = Number(byId("temperature").value);
  const temperature = Number.isFinite(value) && value >= 100 && value <= 600 ? Math.round(value / 10) * 10 : strainState.temperature;
  strainState.temperature = temperature;
  byId("temperature").value = String(temperature);
  updateStrain(strainState.magnitude, strainState.mode);
});
byId("transport-axis").addEventListener("change", () => {
  strainState.transportAxis = AXES.includes(byId("transport-axis").value) ? byId("transport-axis").value : "x";
  updateStrain(strainState.magnitude, strainState.mode);
});

// Presentation choices are separate from the physical bulk strain model.
const teachingState = { compare: false };
function renderTeaching(model) {
  const max = Math.max(...model.populations);
  const leading = AXES.filter((_, i) => Math.abs(model.populations[i] - max) < 1e-8).map(a => `±${a}`).join(', ');
  const direction = AXES.indexOf(strainState.transportAxis);
  byId('insight-title').textContent = strainState.magnitude === 0 ? 'Start with symmetric silicon' : `${strainState.mode === 'biaxial' ? 'Biaxial' : 'Uniaxial'} ${strainState.magnitude > 0 ? 'tension' : 'compression'}: electrons redistribute`;
  byId('insight-text').textContent = strainState.magnitude === 0
    ? 'Each valley pair holds 1/3 of the electrons and transport is isotropic. Choose a scenario to see which bands move down and gain population.'
    : `The ${leading} valleys have the largest populations. Along ${strainState.transportAxis}, mobility is ${model.ratios[direction].toFixed(3)}× its unstrained value. Change direction to explore the anisotropic conductivity mass.`;
}
for (const scenario of ['tensile', 'compressive', 'uniaxial']) {
  byId(`${scenario}-scenario`).addEventListener('click', () => {
    strainState.temperature = 300; strainState.transportAxis = 'x';
    byId('temperature').value = '300'; byId('transport-axis').value = 'x';
    updateStrain(scenario === 'compressive' ? -.005 : .005, scenario === 'uniaxial' ? 'uniaxial' : 'biaxial');
  });
}
byId('compare-toggle').addEventListener('click', () => {
  teachingState.compare = !teachingState.compare;
  byId('compare-toggle').setAttribute('aria-pressed', String(teachingState.compare));
  byId('compare-toggle').textContent = teachingState.compare ? 'Hide unstrained bands' : 'Compare unstrained bands';
  renderPhysics();
});
byId('challenge-toggle').addEventListener('click', () => {
  const content = byId('challenge-content');
  content.hidden = !content.hidden;
  byId('challenge-toggle').setAttribute('aria-expanded', String(!content.hidden));
});
updateStrain(0, "biaxial");

