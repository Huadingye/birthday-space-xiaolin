/* Original in-scene lettering and particle targets, rendered from local fonts. */
(function (root) {
  'use strict';

  root.createBirthdayDedication = function createBirthdayDedication(THREE, scene, options) {
    options = options || {};
    const mobile = !!options.mobile;
    const count = Math.max(1, Math.floor(options.count || 16000));
    const font = '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", "SimSun", serif';
    let seed = 170127, disposed = false;
    let visible = 0, localTime = 0;
    const textures = [], materials = [], geometries = [];
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    function surface(w, h) {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas 2D is required for birthday lettering.');
      context.clearRect(0, 0, w, h);
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      return { canvas, context };
    }

    function sampleTargets(lines, desiredWidth, desiredHeight) {
      const { canvas, context } = surface(1400, 700);
      const fontSize = lines.length === 1 ? 310 : 210;
      context.font = `400 ${fontSize}px ${font}`;
      if (lines.length === 1) {
        context.fillText(lines[0], 700, 350, 1260);
      } else {
        context.fillText(lines[0], 700, 226, 1260);
        context.fillText(lines[1], 700, 490, 1260);
      }
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = image && image.data;
      const sample = [];
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      if (pixels) {
        for (let y = 2; y < canvas.height - 2; y += 2) {
          for (let x = 2; x < canvas.width - 2; x += 2) {
            const alpha = pixels[(y * canvas.width + x) * 4 + 3];
            if (!(alpha >= 112)) continue;
            sample.push([x, y]);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          }
        }
      }
      // A real browser always has local pixel access here. Keep target arrays finite
      // even in a stripped-down Canvas implementation, while exposing readability.
      const readable = sample.length > 0;
      if (!readable) {
        sample.push([700, 350]);
        minX = maxX = 700; minY = maxY = 350;
      }
      const middleX = (minX + maxX) * 0.5;
      const middleY = (minY + maxY) * 0.5;
      const scale = Math.min(desiredWidth / Math.max(1, maxX - minX), desiredHeight / Math.max(1, maxY - minY));
      const output = new Float32Array(count * 3);
      // A coprime stride covers the mask evenly instead of filling one glyph first.
      let stride = Math.max(1, Math.floor(sample.length * .61803398875));
      function gcd(a, b) { while (b) { const rest = a % b; a = b; b = rest; } return a; }
      while (gcd(stride, sample.length) !== 1) stride++;
      for (let i = 0; i < count; i++) {
        const p = sample[(i * stride) % sample.length];
        const k = i * 3;
        output[k] = (p[0] - middleX + (random() - .5) * 1.4) * scale;
        output[k + 1] = (middleY - p[1] + (random() - .5) * 1.4) * scale + .35;
        output[k + 2] = (random() - .5) * .095;
      }
      return { points: output, readable };
    }
    const nameShape = sampleTargets(['小林子'], mobile ? 3.25 : 4.05, 1.12);
    const wishShape = sampleTargets(['祝：小林子', '17岁生日快乐'], mobile ? 3.5 : 4.7, mobile ? 1.68 : 1.98);

    const rootGroup = new THREE.Group();
    rootGroup.name = 'birthday-dedication';
    rootGroup.position.set(0, 2.55, -.3);
    scene.add(rootGroup);
    const time = { value: 0 }, opacity = { value: 0 };

    function inscription(canvas, w, h, y, index) {
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      textures.push(texture);
      const geometry = new THREE.PlaneGeometry(w, h);
      geometries.push(geometry);
      const material = new THREE.ShaderMaterial({
        uniforms: { uMap: { value: texture }, uTime: time, uOpacity: opacity, uIndex: { value: index } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `
          precision highp float;
          uniform sampler2D uMap;
          uniform float uTime, uOpacity, uIndex;
          varying vec2 vUv;
          void main() {
            float alpha = texture2D(uMap,vUv).a;
            if (alpha < .015) discard;
            float travel = fract(uTime*.055 + uIndex*.23);
            float sweepOffset=(vUv.x-travel)*15.0;
            float sweep = exp(-sweepOffset*sweepOffset);
            vec3 ice = mix(vec3(.69,.81,1.0),vec3(.98,.97,1.0),vUv.y*.65+.2);
            ice += vec3(.1,.14,.19)*sweep;
            gl_FragColor = vec4(ice,alpha*uOpacity);
          }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.NormalBlending
      });
      materials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.renderOrder = 10;
      rootGroup.add(mesh);
      return mesh;
    }

    const heading = surface(1400, 360);
    heading.context.font = `400 270px ${font}`;
    const nameWidth = heading.context.measureText('小林子').width;
    heading.context.font = `400 95px ${font}`;
    const prefixWidth = heading.context.measureText('祝：').width;
    const gap = 26;
    const start = (1400 - nameWidth - prefixWidth - gap) * .5;
    heading.context.textAlign = 'left';
    heading.context.fillText('祝：', start, 195);
    heading.context.font = `400 270px ${font}`;
    heading.context.fillText('小林子', start + prefixWidth + gap, 175);
    inscription(heading.canvas, mobile ? 3.58 : 4.0, .87, .3, 0);

    const subheading = surface(1400, 220);
    subheading.context.font = `400 155px ${font}`;
    subheading.context.fillText('17岁生日快乐', 700, 106, 1240);
    inscription(subheading.canvas, mobile ? 2.85 : 3.15, .5, -.3, 1);

    // A swept silver filament echoes the concept's long luminous lettering strokes.
    for (let arc = 0; arc < 2; arc++) {
      const samples = 220;
      const positions = new Float32Array(samples * 3);
      const along = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        const t = i / (samples - 1);
        const theta = t * Math.PI * 1.42 + .28 + arc * Math.PI;
        positions[i * 3] = Math.cos(theta) * (mobile ? 1.86 : 2.18);
        positions[i * 3 + 1] = -.06 + Math.sin(theta) * .19 + (t - .5) * .35;
        positions[i * 3 + 2] = -.025;
        along[i] = t;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
      geometries.push(geo);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: time, uOpacity: opacity, uIndex: { value: arc } },
        vertexShader: 'attribute float aAlong;varying float vAlong;void main(){vAlong=aAlong;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `precision mediump float; uniform float uTime,uOpacity,uIndex; varying float vAlong;
          void main(){float sweep=pow(fract(vAlong-uTime*.055+uIndex*.45),22.0);float edge=sin(vAlong*3.14159265);
          gl_FragColor=vec4(vec3(.55,.73,1.),(.12+sweep*.68)*edge*uOpacity);}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      materials.push(mat);
      const line = new THREE.Line(geo, mat);
      line.renderOrder = 9;
      rootGroup.add(line);
    }

    return {
      root: rootGroup,
      text: '祝：小林子17岁生日快乐',
      readable: nameShape.readable && wishShape.readable,
      targets: { name: nameShape.points, wish: wishShape.points },
      update: function (elapsed, dt, state) {
        if (disposed) return;
        state = state || {};
        const delta = Math.max(0, Math.min(.08, Number.isFinite(dt) ? dt : .016));
        if (!state.reducedMotion) localTime += delta;
        time.value = localTime;
        const intro = Number.isFinite(state.intro) ? Math.max(0, Math.min(1, state.intro)) : 1;
        const featured = ['constellation', 'inscription', 'finale'].includes(state.mode);
        const desired = (featured ? .18 : .95) * intro;
        visible += (desired - visible) * (1 - Math.exp(-delta * 4.5));
        opacity.value = visible;
        if (state.camera && state.camera.quaternion) rootGroup.quaternion.copy(state.camera.quaternion);
      },
      resize: function (aspect) {
        if (disposed) return;
        const narrow = Number.isFinite(aspect) && aspect < .6;
        rootGroup.scale.setScalar(narrow ? .92 : 1);
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        scene.remove(rootGroup);
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        textures.forEach(texture => texture.dispose());
        rootGroup.clear();
      }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
