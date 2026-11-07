/* Original procedural environment. Three.js r128; no fetched assets or textures. */
(function () {
  "use strict";

  window.createBirthdayAtmosphere = function createBirthdayAtmosphere(THREE, scene, options) {
    options = options || {};
    const mobile = !!options.mobile;
    const root = new THREE.Group();
    root.name = "birthday-atmosphere";
    scene.add(root);
    let disposed = false;
    let pulseSlot = 0;
    let energy = 0;
    let bloom = 0;
    let moonFlash = 0;
    let motionTime = 0;
    let seed = 1789187;
    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const timeUniform = { value: 0 };
    const motionUniform = { value: 0 };
    const energyUniform = { value: 0 };
    const bloomUniform = { value: 0 };
    const moonFlashUniform = { value: 0 };
    const ratioUniform = { value: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.8) };
    const pulses = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -10000, 0));

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(62, 28, 18),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        defines: { CLOUD_OCTAVES: mobile ? 3 : 4 },
        uniforms: {
          uTime: motionUniform,
          uEnergy: energyUniform,
          uBloom: bloomUniform
        },
        vertexShader: `
          varying vec3 vDirection;
          void main() {
            vDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec3 vDirection;
          uniform float uTime;
          uniform float uEnergy;
          uniform float uBloom;
          float hash(vec3 p) {
            p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          float noise(vec3 p) {
            vec3 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                           mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                           mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
          }
          float cloud(vec3 p) {
            float value = 0.0;
            float amplitude = 0.52;
            for (int i = 0; i < CLOUD_OCTAVES; i++) {
              value += amplitude * noise(p);
              p = p * 2.03 + vec3(4.1, 1.7, 6.3);
              amplitude *= 0.48;
            }
            return value;
          }
          void main() {
            vec3 d = normalize(vDirection);
            vec3 p = d * vec3(3.2, 5.3, 2.4);
            p.x += uTime * 0.009;
            p.z += sin(uTime * 0.012) * 0.08;
            float wisps = cloud(p + cloud(p * 1.05) * 0.55);
            float belt = exp(-pow(abs((d.y - 0.11 - d.x * 0.12) * 4.9), 2.0));
            float light = smoothstep(0.28, 0.85, wisps) * belt;
            float backHalo = pow(max(0.0, dot(d, normalize(vec3(0.0, 0.18, -1.0)))), 13.0);
            vec3 midnight = mix(vec3(0.008, 0.011, 0.024), vec3(0.025, 0.017, 0.041), max(0.0, d.y));
            vec3 mist = mix(vec3(0.11, 0.09, 0.18), vec3(0.15, 0.09, 0.14), wisps);
            vec3 color = midnight + mist * light * 0.98;
            color += vec3(0.08, 0.11, 0.15) * backHalo * (0.42 + 0.13 * uEnergy);
            color += vec3(0.045, 0.027, 0.032) * belt * uBloom;
            color *= smoothstep(-0.18, 0.02, d.y) * 0.75 + 0.25;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      })
    );
    sky.renderOrder = -100;
    root.add(sky);

    const moonCenter = new THREE.Vector3(-4, 3.3, -7);
    const moonLight = new THREE.Vector3(-0.86, 0.39, -0.56).normalize();
    const moonCraters = [];
    for (let i = 0; i < 18; i++) {
      const theta = random() * Math.PI * 2;
      const z = random() * 1.72 - 0.72;
      const r = Math.sqrt(1 - z * z);
      moonCraters.push(new THREE.Vector4(Math.cos(theta) * r, Math.sin(theta) * r, z, 0.055 + random() * 0.18));
    }
    const moonVertex = `
      varying vec3 vSurface;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vSurface = normalize(position);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, mobile ? 36 : 56, mobile ? 28 : 40),
      new THREE.ShaderMaterial({
        uniforms: { uLight: { value: moonLight }, uCraters: { value: moonCraters }, uBloom: bloomUniform, uMoonFlash: moonFlashUniform },
        vertexShader: moonVertex,
        fragmentShader: `
          precision highp float;
          uniform vec3 uLight;
          uniform vec4 uCraters[18];
          uniform float uBloom;
          uniform float uMoonFlash;
          varying vec3 vSurface;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;
          float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
          float noise(vec3 p) {
            vec3 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                           mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                       mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                           mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
          }
          void main() {
            vec3 surface = normalize(vSurface);
            vec3 normal = normalize(vWorldNormal);
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float maria = noise(surface * 4.2 + 2.1);
            float detail = noise(surface * 18.0) * 0.6 + noise(surface * 43.0) * 0.4;
            float texture = 0.63 + maria * 0.24 + detail * 0.13;
            for (int i = 0; i < 18; i++) {
              float distanceToCrater = length(surface - uCraters[i].xyz) / uCraters[i].w;
              float basin = 1.0 - smoothstep(0.45, 0.91, distanceToCrater);
              float rim = exp(-pow(abs((distanceToCrater - 1.0) * 9.0), 2.0));
              texture += rim * 0.11 - basin * 0.17;
            }
            float sunAngle = dot(normal, uLight);
            float daylight = pow(max(0.0, sunAngle), 0.63);
            float terminator = smoothstep(-0.012, 0.04, sunAngle);
            vec3 silver = mix(vec3(0.65, 0.63, 0.76), vec3(0.97, 0.85, 0.68), daylight * 0.7);
            vec3 color = vec3(0.009, 0.012, 0.021) * (0.68 + texture * 0.32);
            color += silver * texture * daylight * terminator * (0.83 + uBloom * 0.07);
            color += vec3(0.32, 0.39, 0.56) * uMoonFlash * (0.25 + daylight * 0.42);
            float rim = pow(1.0 - max(0.0, dot(normal, viewDirection)), 6.0);
            color += vec3(0.11, 0.10, 0.16) * rim * 0.26;
            color += vec3(0.21, 0.18, 0.15) * rim * terminator * 0.25;
            gl_FragColor = vec4(color, 1.0);
          }
        `
      })
    );
    moon.name = "crescent-moon";
    moon.position.copy(moonCenter);
    moon.renderOrder = -70;
    root.add(moon);
    const moonRim = new THREE.Mesh(
      new THREE.SphereGeometry(1.235, 36, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uLight: { value: moonLight }, uBloom: bloomUniform },
        vertexShader: moonVertex,
        fragmentShader: `
          uniform vec3 uLight;
          uniform float uBloom;
          varying vec3 vWorldNormal;
          varying vec3 vWorldPosition;
          void main() {
            vec3 n = normalize(vWorldNormal);
            vec3 v = normalize(cameraPosition - vWorldPosition);
            float rim = pow(1.0 - abs(dot(n, v)), 5.0);
            float lit = smoothstep(-0.12, 0.5, dot(n, uLight));
            gl_FragColor = vec4(0.84, 0.76, 0.94, rim * (0.012 + lit * 0.11 + uBloom * 0.08));
          }
        `
      })
    );
    moonRim.position.copy(moonCenter);
    moonRim.renderOrder = -65;
    root.add(moonRim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: timeUniform,
          uMotion: motionUniform,
          uEnergy: energyUniform,
          uBloom: bloomUniform,
          uPulses: { value: pulses }
        },
        vertexShader: `
          varying vec2 vGround;
          void main() {
            vGround = position.xy;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          varying vec2 vGround;
          uniform float uTime;
          uniform float uMotion;
          uniform float uEnergy;
          uniform float uBloom;
          uniform vec4 uPulses[8];
          void main() {
            // Plane local y becomes world -z after the horizontal rotation.
            vec2 p = vec2(vGround.x, -vGround.y);
            float r = length(p);
            float angle = atan(p.y, p.x);
            float fade = exp(-r * 0.072);
            vec3 color = vec3(0.009, 0.012, 0.024);
            float pool = exp(-dot(p * vec2(0.45, 0.29), p * vec2(0.45, 0.29)));
            float reflection = exp(-abs(p.x) * 1.4) * exp(-abs(p.y - 0.3) * 0.31);
            float brokenLight = 0.56 + 0.23 * sin(p.y * 16.0 + sin(p.x * 10.0) * 2.0 + uMotion * 0.7);
            color += vec3(0.16, 0.10, 0.13) * pool * 0.22;
            color += vec3(0.22, 0.15, 0.12) * reflection * brokenLight * (0.17 + uEnergy * 0.16);
            float pondWave = sin(r * 9.0 - uMotion * 0.6 + sin(angle * 5.0) * 0.2);
            float fineWave = smoothstep(0.94, 1.0, pondWave) * exp(-r * 0.37) * smoothstep(1.9, 2.3, r);
            color += vec3(0.13, 0.20, 0.22) * fineWave * 0.16;
            float orbit = exp(-pow(abs((r - 2.35) * 52.0), 2.0));
            orbit += exp(-pow(abs((r - 2.43) * 84.0), 2.0)) * 0.35;
            orbit *= 0.34 + 0.23 * sin(angle * 3.0 + uMotion * 0.11);
            color += vec3(0.42, 0.30, 0.21) * orbit * (0.6 + uEnergy * 0.4);
            for (int i = 0; i < 8; i++) {
              float age = uTime - uPulses[i].z;
              if (age >= 0.0 && age < 4.5) {
                float d = length(p - uPulses[i].xy);
                float ring = exp(-pow(abs((d - age * 2.2) * 6.8), 2.0));
                float echo = exp(-pow(abs((d - age * 2.2 + 0.22) * 9.0), 2.0)) * 0.3;
                float strength = pow(1.0 - age / 4.5, 2.0) * uPulses[i].w;
                color += vec3(0.27, 0.33, 0.35) * (ring + echo) * strength * 0.6;
              }
            }
            color += vec3(0.12, 0.08, 0.07) * pool * uBloom;
            gl_FragColor = vec4(color, min(0.54, fade * 0.7));
          }
        `
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.43;
    floor.renderOrder = -80;
    root.add(floor);

    const starsCount = mobile ? 760 : 1400;
    const starsPosition = new Float32Array(starsCount * 3);
    const starsSeed = new Float32Array(starsCount * 2);
    for (let i = 0; i < starsCount; i++) {
      const theta = random() * Math.PI * 2;
      const y = random() * 0.88 - 0.1;
      const r = 20 + random() * 34;
      const horizontal = Math.sqrt(1 - y * y);
      starsPosition[i * 3] = Math.cos(theta) * r * horizontal;
      starsPosition[i * 3 + 1] = y * r;
      starsPosition[i * 3 + 2] = Math.sin(theta) * r * horizontal;
      starsSeed[i * 2] = random();
      starsSeed[i * 2 + 1] = random();
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starsPosition, 3));
    starGeometry.setAttribute("aSeed", new THREE.BufferAttribute(starsSeed, 2));
    const starMaterial = new THREE.ShaderMaterial({
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: motionUniform, uPixelRatio: ratioUniform, uBloom: bloomUniform },
      vertexShader: `
        attribute vec2 aSeed;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uBloom;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.7 + pow(aSeed.x, 6.0) * 3.8) * uPixelRatio;
          vAlpha = (0.22 + aSeed.y * 0.46) * (0.74 + sin(uTime * 0.35 + aSeed.x * 90.0) * 0.26);
          vAlpha *= 1.0 + uBloom * 0.35;
          vColor = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.77, 0.64), aSeed.y);
        }
      `,
      fragmentShader: `
        precision mediump float;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float d = length(p);
          float halo = exp(-d * d * 4.5);
          float center = exp(-d * d * 22.0);
          gl_FragColor = vec4(vColor, (halo * 0.4 + center * 0.6) * vAlpha);
        }
      `
    });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    starPoints.frustumCulled = false;
    root.add(starPoints);

    const arcCount = mobile ? 3 : 4;
    const arcSamples = 360;
    for (let arc = 0; arc < arcCount; arc++) {
      const positions = new Float32Array(arcSamples * 3);
      const coords = new Float32Array(arcSamples);
      const r = 2.68 + arc * 0.42;
      for (let i = 0; i < arcSamples; i++) {
        const u = i / (arcSamples - 1);
        const a = u * Math.PI * 1.88 + arc * 1.18;
        positions[i * 3] = Math.cos(a) * r;
        positions[i * 3 + 1] = -0.55 + Math.sin(a + arc * 0.6) * (0.5 + arc * 0.2) + arc * 0.14;
        positions[i * 3 + 2] = Math.sin(a) * r * (0.82 + arc * 0.035);
        coords[i] = u;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aAlong", new THREE.BufferAttribute(coords, 1));
      const color = arc % 3 === 0 ? new THREE.Color(0.77, 0.57, 0.39) : arc % 3 === 1 ? new THREE.Color(0.67, 0.39, 0.51) : new THREE.Color(0.36, 0.65, 0.66);
      const uniforms = { uTime: motionUniform, uEnergy: energyUniform, uIndex: { value: arc }, uColor: { value: color }, uPixelRatio: ratioUniform };
      const vertex = `
        attribute float aAlong;
        uniform float uTime;
        uniform float uEnergy;
        uniform float uIndex;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float rotation = uTime * (0.014 + uIndex * 0.004);
          p.xz = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation)) * p.xz;
          p.y += sin(aAlong * 12.0 + uTime * 0.35) * 0.035;
          p.xz *= 1.0 - uEnergy * 0.09;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float travel = fract(aAlong - uTime * 0.055 + uIndex * 0.23);
          float trail = pow(travel, 24.0);
          vAlpha = (0.09 + trail * 0.7 + uEnergy * 0.18) * sin(aAlong * 3.14159265);
          gl_PointSize = clamp((0.9 + trail * 2.8) * 7.0 / max(1.0, -mv.z), 0.55, 3.5) * uPixelRatio;
        }
      `;
      const line = new THREE.Line(geometry, new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms,
        vertexShader: vertex,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() { gl_FragColor = vec4(uColor, vAlpha); }
        `
      }));
      root.add(line);
      const beads = new THREE.Points(geometry, new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms,
        vertexShader: vertex,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float alpha = exp(-d * d * 28.0);
            gl_FragColor = vec4(uColor * 1.3, alpha * vAlpha * 0.7);
          }
        `
      }));
      root.add(beads);
    }

    const moteCount = mobile ? 250 : 540;
    const motePosition = new Float32Array(moteCount * 3);
    const moteSeed = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 2.8 + random() * 9.5;
      motePosition[i * 3] = Math.cos(angle) * radius;
      motePosition[i * 3 + 1] = -1.0 + random() * 7.0;
      motePosition[i * 3 + 2] = Math.sin(angle) * radius;
      moteSeed[i * 3] = random();
      moteSeed[i * 3 + 1] = random();
      moteSeed[i * 3 + 2] = random();
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePosition, 3));
    moteGeometry.setAttribute("aSeed", new THREE.BufferAttribute(moteSeed, 3));
    const motes = new THREE.Points(moteGeometry, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: motionUniform, uEnergy: energyUniform, uPixelRatio: ratioUniform },
      vertexShader: `
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uEnergy;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float a = uTime * (0.008 + aSeed.y * 0.018);
          p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
          p.y += sin(uTime * 0.3 + aSeed.x * 20.0) * 0.22;
          p.xz *= 1.0 - uEnergy * 0.11;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((6.0 + aSeed.x * 15.0) / max(-mv.z, 1.0), 0.7, 7.5) * uPixelRatio;
          vAlpha = smoothstep(0.5, 2.8, -mv.z) * (0.16 + aSeed.z * 0.25) * (0.7 + 0.3 * sin(uTime * 0.8 + aSeed.y * 40.0));
          vColor = mix(vec3(1.0, 0.69, 0.58), vec3(0.65, 0.83, 0.91), aSeed.y);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float r = length(gl_PointCoord * 2.0 - 1.0);
          gl_FragColor = vec4(vColor, exp(-r * r * 4.8) * vAlpha);
        }
      `
    }));
    motes.frustumCulled = false;
    root.add(motes);

    // A small number of translucent petal flecks provide parallax at a different scale.
    const petalCount = mobile ? 28 : 56;
    const petalGeometry = new THREE.InstancedBufferGeometry();
    petalGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      -1,-1,0, 1,-1,0, 1,1,0,
      -1,-1,0, 1,1,0, -1,1,0
    ]), 3));
    const offsets = new Float32Array(petalCount * 3);
    const petalsSeed = new Float32Array(petalCount * 3);
    for (let i = 0; i < petalCount; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 3.2 + random() * 8;
      offsets[i * 3] = Math.cos(angle) * radius;
      offsets[i * 3 + 1] = random() * 8;
      offsets[i * 3 + 2] = Math.sin(angle) * radius;
      petalsSeed[i * 3] = random();
      petalsSeed[i * 3 + 1] = random();
      petalsSeed[i * 3 + 2] = random();
    }
    petalGeometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    petalGeometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(petalsSeed, 3));
    petalGeometry.instanceCount = petalCount;
    const petals = new THREE.Mesh(petalGeometry, new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: motionUniform, uEnergy: energyUniform },
      vertexShader: `
        attribute vec3 aOffset;
        attribute vec3 aSeed;
        uniform float uTime;
        uniform float uEnergy;
        varying vec2 vLocal;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vLocal = position.xy;
          float turn = uTime * (0.16 + aSeed.x * 0.22) + aSeed.y * 6.28;
          vec3 p = position * (0.028 + aSeed.z * 0.041);
          p.x *= 0.48;
          p.z = sin(position.y * 1.8) * 0.015;
          p.xy = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * p.xy;
          p.xz = mat2(cos(turn * 0.7), -sin(turn * 0.7), sin(turn * 0.7), cos(turn * 0.7)) * p.xz;
          vec3 center = aOffset;
          center.y = mod(aOffset.y - uTime * (0.025 + aSeed.z * 0.025), 8.5) - 1.1;
          center.x += sin(uTime * 0.1 + aSeed.y * 8.0) * 0.32;
          center.z += cos(uTime * 0.12 + aSeed.x * 7.0) * 0.22;
          center.xz *= 1.0 - uEnergy * 0.12;
          vec4 mv = modelViewMatrix * vec4(p + center, 1.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = (0.22 + aSeed.x * 0.25) * smoothstep(-1.1, -0.6, center.y) * smoothstep(0.5, 2.0, -mv.z);
          vColor = mix(vec3(0.91, 0.54, 0.65), vec3(0.81, 0.84, 0.91), aSeed.z);
        }
      `,
      fragmentShader: `
        varying vec2 vLocal;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float outline = length(vec2(vLocal.x * (1.0 + vLocal.y * 0.3), vLocal.y));
          float alpha = (1.0 - smoothstep(0.72, 1.0, outline)) * vAlpha;
          if (alpha < 0.005) discard;
          float vein = exp(-abs(vLocal.x) * 9.0) * 0.15;
          gl_FragColor = vec4(vColor + vein, alpha);
        }
      `
    }));
    petals.frustumCulled = false;
    root.add(petals);

    return {
      root,
      pulse: function (x, z, time, strength) {
        if (disposed) return;
        pulses[pulseSlot].set(x || 0, z || 0, Number.isFinite(time) ? time : timeUniform.value, strength == null ? 1 : Math.max(0, strength));
        pulseSlot = (pulseSlot + 1) % pulses.length;
      },
      flash: function (strength) {
        if (disposed) return;
        moonFlash = Math.max(moonFlash, Math.min(1.8, Math.max(.25, strength || 1)));
        moonFlashUniform.value = moonFlash;
      },
      resize: function (pixelRatio) {
        ratioUniform.value = Math.min(pixelRatio || window.devicePixelRatio || 1, mobile ? 1.5 : 1.8);
      },
      update: function (time, dt, state) {
        if (disposed) return;
        state = state || {};
        const delta = Math.min(0.06, Math.max(0, dt || 0));
        const reduce = state.reducedMotion == null ? !!options.reducedMotion : !!state.reducedMotion;
        motionTime += delta * (reduce ? 0 : 1);
        timeUniform.value = time;
        motionUniform.value = motionTime;
        const desiredEnergy = Number.isFinite(state.energy) ? Math.max(0, Math.min(1, state.energy)) : 0;
        moonFlash *= Math.exp(-delta * 1.1);
        moonFlashUniform.value = moonFlash;
        const burst = Number.isFinite(state.burst) ? Math.max(0, Math.min(1, state.burst)) : state.burst ? 1 : 0;
        const desiredBloom = Math.min(1.8, burst + moonFlash * .65);
        const ease = 1 - Math.exp(-delta * 8);
        energy += (desiredEnergy - energy) * ease;
        bloom += (desiredBloom - bloom) * ease;
        energyUniform.value = energy;
        bloomUniform.value = bloom;
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        scene.remove(root);
        const geometries = new Set();
        const materials = new Set();
        root.traverse(function (node) {
          if (node.geometry) geometries.add(node.geometry);
          if (node.material) {
            if (Array.isArray(node.material)) node.material.forEach(m => materials.add(m));
            else materials.add(node.material);
          }
        });
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        root.clear();
      }
    };
  };
})();
