# Strain Engineering in Silicon

An educational semiconductor physics simulator using only HTML, CSS and vanilla JavaScript. Open `index.html` directly in a browser; no installation, internet access, build step or server is required. Enable JavaScript for simulations. External source links are optional reading.

## Using the simulator

- Apply -2.0% to +2.0% strain in 0.1% steps; choose Biaxial or Uniaxial mode.
- Change temperature (100–600 K, 10 K steps) to explore thermal valley populations.
- Select x, y or z transport direction to change local band cuts, conductivity mass, mobility ratios and the nMOS illustration.
- Reset restores zero strain, Biaxial mode, 300 K and x transport.
- Expand **Model equations, assumptions & sources** for the physics behind the displays.

The compact desktop dashboard shows a real-space lattice, reciprocal-space valleys, local conduction-band dispersion and transport readouts together. Mobile screens stack the panels. The full-width CMOS section compares normalized output curves under current strain and zero strain.

## Model assumptions

Coordinates align with silicon [100], [010] and [001]. Engineering strains are dimensionless fractions internally: 0.02 = 2%. Off-diagonal strains are zero.

### Strain

The small-strain, isotropic elasticity approximation uses nu = 0.28. Biaxial strain imposes epsilonXX = epsilonYY = e with zero out-of-plane stress, giving epsilonZZ = -2 nu/(1-nu) e. Uniaxial strain imposes epsilonXX = e with free transverse surfaces, giving epsilonYY = epsilonZZ = -nu e. Silicon is anisotropic; this approximation does not cover arbitrary orientations.

### Real and reciprocal space

The conventional diamond-cubic SVG cell consists of FCC sites plus the quarter-cell basis, with nearest-neighbor bonds inside the cell. Atom positions are centered and scaled by `1 + VISUAL_EXAGGERATION * epsilonII`, using VISUAL_EXAGGERATION = 12 solely for real-space rendering. Physical readouts, energies, populations and transport never use this factor. The dashed cell is the unstrained reference.

Reciprocal coordinates transform using F^-T with F = I + epsilon, without exaggeration. Valley centers are fixed at +/-0.85 in their reduced reciprocal axes, then transformed into unstrained 2pi/a0 units. Internal shifts of reduced valley positions are omitted. Ellipsoids indicate axis and schematic anisotropy; their size is not a numerical constant-energy contour. Color/opacity and numeric readouts indicate populations.

### Valleys and local bands

Relative conduction-valley edges use `E_i = XiU * (epsilonII - trace(epsilon)/3)` with XiU = 9.16 eV. The common energy shift is removed; the mean valley edge is the energy reference. No absolute band gap is predicted. Each +/- pair remains degenerate.

Fixed Delta-valley masses are mL = 0.903 m0 and mT = 0.191 m0. Local conduction cuts use `E(q) = E_i + hbar^2 q^2/(2 m_ij)` along the selected direction, for q between -0.35 and +0.35 nm^-1 relative to each valley minimum. hbar^2/(2m0) = 0.03809982 eV nm^2. The plot is not a global Brillouin-zone band structure; valence bands, nonparabolicity and strain-dependent curvature are excluded.

### Population and transport

Nondegenerate Boltzmann populations at the selected temperature use `P_i proportional to exp(-(E_i - Emin)/(kB T))`. Equal pair degeneracies and fixed density-of-states masses cancel in normalization. Populations sum to one across the three pairs.

Directional conductivity mass is `1/mCond_j = sum_i P_i/m_ij`. At zero strain each pair has one-third population, mCond is about 0.259 m0, and transport is isotropic. Relative mobility uses `mu_j/mu0 = mCond0/mCond_j`, with the same constant relaxation time at the same temperature. This isolates valley repopulation; no absolute mobility or scattering rate is predicted. Temperature changes populations only.

### CMOS illustration

For an ideal long-channel nMOS with fixed gate overdrive, dimensions, capacitance and threshold, let v = VDS/Vov and r = mu/mu0. Then `I/I0,sat = r * (2v - v^2)` in the linear region (0 <= v <= 1), and `I/I0,sat = r` in saturation. The graph and displayed saturation-current ratio follow this model directly.

This is an educational bulk-electron proxy, not a calibrated transistor prediction. Interface confinement, scattering changes, threshold shifts, channel-length modulation, velocity saturation, hole bands and strain relaxation are omitted. The CMOS section explains why pMOS needs a separate hole model. Linear approximations are illustrative at large strain, including the slider endpoints.

## State and extension

One stable `window.strainState` object contains magnitude, mode, epsilonXX, epsilonYY, epsilonZZ, temperature and transportAxis. `updateStrain(magnitude, mode)` updates the tensor and all panels, then dispatches `strainchange` on window with that object as event.detail. Future consumers can read this shared state. Electron calculations and band/current functions are separate from SVG rendering for testing.

## Sources

- [Hopcroft et al.: silicon elastic anisotropy and Poisson ratio](https://mems.stanford.edu/~hopcroft/Publications/Hopcroft_Youngs_Modulus_Silicon.pdf)
- [Dhar, TU Wien: deformation-potential strain theory](https://www.iue.tuwien.ac.at/phd/dhar/node19.html)
- [Wang et al., Physical Review B 83, 195318: deformation-potential parameter discussion](https://link.aps.org/accepted/10.1103/PhysRevB.83.195318)
- [Smirnov, TU Wien: analytical band structures and valley masses](https://iue.tuwien.ac.at/phd/smirnov/node45.html)
- [Dhar, TU Wien: strained-silicon valley populations and transport](https://www.iue.tuwien.ac.at/phd/dhar/node23.html)
- [Wessner, TU Wien: silicon Delta-valley locations](https://iue.tuwien.ac.at/phd/wessner/node31.html)

## Verification

With Node.js available:

```sh
node --check script.js
node tests/strain.test.cjs
```

Dependency-free tests cover all 41 slider settings in both modes, tensor formulas, SVG lattice topology/bounds, state identity and reset. They also check 738 combinations of mode, strain, temperature and direction for population normalization, valley ordering/symmetry, positive bounded masses, thermal behavior, local parabolic dispersion, normalized nMOS curves, control events and accessibility label targets.

Browser verification used locally installed Edge through Playwright at desktop and mobile sizes, opening index.html via file URL. Checks include horizontal overflow, desktop panel visibility and content containment, strain/mode/temperature/direction updates, reset, expandable model notes, and JavaScript errors. Playwright is a development check only; the website has no runtime dependencies.

## Assignment-focused interface

The English interface focuses on the assignment: mechanical strain changes electronic transport through band splitting and carrier effective mass. Scenario buttons compare tensile and compressive strain; unstrained-band overlays and live explanations connect band energies, valley populations, conductivity mass and directional mobility.

Nanocrystal confinement, direct-gap emission and the standalone HH/LH illustration have been removed from the page to keep the focus on device transport. The current numerical model covers silicon conduction electrons; fixed valley curvature and hole-transport limitations are stated in the model notes.
