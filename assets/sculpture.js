/* Original birthday light sculpture. No textures or network requests. */
(function (root) {
  'use strict';
  function createBirthdaySculpture(THREE, mobile) {
    let seed = 171121;
    function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    const points = [], colors = [], types = [];
    const palette = ['#eef4ff', '#bdc6f3', '#aeb1e8', '#ffe7ac', '#b4e8df'].map(c => new THREE.Color(c));
    const countScale = mobile ? 0.58 : 1;
    const TAU = Math.PI * 2;
    function add(x, y, z, color, kind = 0) {
      points.push(x, y, z);
      const gain = 0.72 + random() * 0.28;
      const c = palette[color];
      colors.push(c.r * gain, c.g * gain, c.b * gain);
      types.push(kind);
    }
    function circle(radius, y, count, color, twist = 0) {
      for (let i = 0; i < count; i++) {
        const a = i / count * TAU;
        add(radius * Math.cos(a), y + twist * Math.sin(a * 12), radius * Math.sin(a), color, 1);
      }
    }
    const tiers = [
      { r: 1.57, y: -1.18, h: 0.69 },
      { r: 1.19, y: -0.47, h: 0.64 },
      { r: 0.79, y: 0.19, h: 0.59 }
    ];
    for (let t = 0; t < tiers.length; t++) {
      const { r, y, h } = tiers[t];
      // Stratified shell, satin top, and a sparse translucent core.
      const sideCount = Math.floor((7200 - t * 1600) * countScale);
      for (let i = 0; i < sideCount; i++) {
        const angle = random() * TAU;
        const height = random();
        const pleat = 0.016 * Math.cos(angle * 48);
        const rad = r + pleat + (random() - .5) * .025;
        add(rad * Math.cos(angle), y + height * h, rad * Math.sin(angle), height > .83 ? 0 : (i % 5 === 0 ? 2 : 1));
      }
      const topCount = Math.floor((2600 - t * 650) * countScale);
      for (let i = 0; i < topCount; i++) {
        const a = random() * TAU;
        const rad = Math.sqrt(random()) * r;
        add(rad * Math.cos(a), y + h + random() * .012, rad * Math.sin(a), i % 4 === 0 ? 3 : 0);
      }
      circle(r + .01, y + .02, Math.floor(720 * countScale), 3);
      circle(r + .012, y + h - .015, Math.floor(800 * countScale), 0);
      circle(r + .035, y + h - .065, Math.floor(620 * countScale), 3);
      // Beaded icing swags wrap the actual cylindrical surface.
      for (let i = 0; i < Math.floor(1700 * countScale); i++) {
        const a = random() * TAU;
        const drop = Math.pow((Math.sin(a * 9) + 1) / 2, .65) * .18;
        const rad = r + .026 + random() * .015;
        add(rad * Math.cos(a), y + h - .075 - drop + (random() - .5) * .022, rad * Math.sin(a), i % 6 ? 0 : 3, 1);
      }
      // Pearl-sized flower rosettes around each tier.
      const rosettes = 14 - t * 3;
      for (let k = 0; k < rosettes; k++) {
        const a = k / rosettes * TAU;
        const centerRadius = r * .87;
        for (let j = 0; j < 80 * countScale; j++) {
          const theta = random() * TAU;
          const rr = .045 + .035 * Math.sin(theta * 5);
          add(centerRadius * Math.cos(a) + Math.cos(theta) * rr,
            y + h + .035 + random() * .045,
            centerRadius * Math.sin(a) + Math.sin(theta) * rr, k % 4 === 0 ? 3 : 0, 1);
        }
      }
    }
    const candles = [];
    for (let k = 0; k < 7; k++) {
      const a = k / 6 * TAU;
      const x = k === 6 ? 0 : Math.cos(a) * .46;
      const z = k === 6 ? 0 : Math.sin(a) * .46;
      const height = k === 6 ? .65 : .44;
      candles.push(new THREE.Vector3(x, .79 + height + .07, z));
      for (let i = 0; i < 270 * countScale; i++) {
        const theta = random() * TAU;
        const h = random() * height;
        add(x + Math.cos(theta) * .026, .79 + h, z + Math.sin(theta) * .026, 3, 1);
      }
      for (let i = 0; i < 175 * countScale; i++) {
        const u = random(), theta = random() * TAU;
        const r = Math.sin(u * Math.PI) * .032;
        add(x + r * Math.cos(theta), .79 + height + u * .17, z + r * Math.sin(theta), i % 3 ? 3 : 0, 2);
      }
    }
    circle(1.78, -1.24, 1000 * countScale, 3);
    circle(1.86, -1.27, 1000 * countScale, 2);
    // Two hand-drawn serif numeral silhouettes, sampled as filled polygons.
    const polygons = [
      [[-1.23, .92], [-.63, 1.45], [-.4, 1.45], [-.4, -1.2], [-.02, -1.25], [-.02, -1.36], [-1.18, -1.36], [-1.18, -1.25], [-.83, -1.2], [-.83, 1.06], [-1.18, .83]],
      [[.13, 1.4], [1.69, 1.4], [1.69, 1.24], [.79, -1.36], [.25, -1.36], [1.43, 1.07], [.39, 1.07], [.22, .78], [.09, .78]]
    ];
    function inside(x, y, polygon) {
      let result = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) result = !result;
      }
      return result;
    }
    const count = types.length, targets = new Float32Array(count * 3);
    const burst = new Float32Array(count * 3), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let x, y;
      do { x = -1.23 + random() * 2.92; y = -1.36 + random() * 2.81; }
      while (!polygons.some(p => inside(x, y, p)));
      targets[i * 3] = (x - .2) * 1.12;
      targets[i * 3 + 1] = y * 1.12 + .32;
      targets[i * 3 + 2] = (random() - .5) * .14;
      const theta = random() * TAU, v = random() * 2 - 1, s = Math.sqrt(1 - v * v);
      const radius = 4 + Math.pow(random(), .65) * 12;
      burst[i * 3] = Math.cos(theta) * s * radius;
      burst[i * 3 + 1] = v * radius * .65;
      burst[i * 3 + 2] = Math.sin(theta) * s * radius;
      seeds[i] = random();
    }
    return { positions: new Float32Array(points), colors: new Float32Array(colors), types: new Float32Array(types), targets, burst, seeds, count, tiers, candles };
  }
  root.createBirthdaySculpture = createBirthdaySculpture;
  if (typeof module !== 'undefined' && module.exports) module.exports = createBirthdaySculpture;
})(typeof window !== 'undefined' ? window : globalThis);
