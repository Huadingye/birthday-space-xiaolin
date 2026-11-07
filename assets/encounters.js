/* Original spatial toys for the birthday scene. Three.js r128; no network or DOM UI.
 * createBirthdayEncounters(THREE, scene, options) ->
 * { update(time, dt, state), pick(raycaster, time), activate(index, time), meteorShower(time, strength),
 *   getProgress(), resize(pixelRatio), dispose() }
 * pick() changes a crystal's state / activates the butterfly and returns
 * { kind: 'star'|'portal'|'moon', index, point: THREE.Vector3, lit?, completed? }.
 * onComplete fires once for each completed set; all crystals reset eight seconds later.
 */
(function () {
  'use strict';
  window.createBirthdayEncounters = function createBirthdayEncounters(THREE, scene, options) {
    options = options || {};
    const mobile = !!options.mobile;
    const root = new THREE.Group();
    root.name = 'birthday-encounters';
    scene.add(root);
    const hits = [], crystals = [], geometrySet = new Set(), materialSet = new Set();
    let disposed = false, lastTime = 0, motionTime = 0, completeAt = -Infinity;
    let completed = false, portalAt = -Infinity, moonAt = -Infinity, meteorCursor = 0, nextAmbient = 5.5;
    let reduced = !!options.reducedMotion, pixelRatio = 1;
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const geometry = g => (geometrySet.add(g), g);
    const material = m => (materialSet.add(m), m);
    const tintBlue = new THREE.Color('#b9caff');
    const tintGold = new THREE.Color('#ffe0a7');
    const blue = new THREE.Color('#96b8ef');
    const quadGeometry = geometry(new THREE.PlaneGeometry(1, 1));
    const hitGeometry = geometry(new THREE.SphereGeometry(mobile ? .37 : .31, 12, 8));
    const hitMaterial = material(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));

    function lightHalo(size, color) {
      const mat = material(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uSize: { value: size }, uColor: { value: color }, uLight: { value: .6 } },
        vertexShader: `
          uniform float uSize; varying vec2 vUv;
          void main(){vUv=uv;vec4 center=modelViewMatrix*vec4(0.,0.,0.,1.);
            center.xy+=position.xy*uSize;gl_Position=projectionMatrix*center;}
        `,
        fragmentShader: `
          precision highp float;varying vec2 vUv;uniform vec3 uColor;uniform float uLight;
          void main(){vec2 p=(vUv-.5)*2.;float r=length(p);
            float mist=exp(-r*r*7.)*.25;
            float core=exp(-r*r*60.);
            float rays=(exp(-abs(p.x)*65.)*exp(-abs(p.y)*4.)+exp(-abs(p.y)*65.)*exp(-abs(p.x)*4.))*.22;
            float edge=1.-smoothstep(.65,1.,r);
            gl_FragColor=vec4(uColor,(mist+core+rays)*edge*uLight);}
        `
      }));
      const mesh = new THREE.Mesh(quadGeometry, mat);
      mesh.frustumCulled = false;
      return mesh;
    }

    const crystalGeometry = geometry(new THREE.OctahedronGeometry(.105, 0));
    const angles = [.12, 1.30, 2.62, 3.9, 5.23];
    const radii = mobile ? [2.12, 2.3, 2.18, 2.24, 2.2] : [2.62, 2.72, 2.57, 2.64, 2.67];
    // Separate the near and far crystals vertically so their touch targets do
    // not cover one another in the initial portrait view.
    const heights = mobile ? [-.65, .28, .95, -.5, .7] : [-.15, .28, .78, .48, -.2];
    const projected = new THREE.Vector3();
    function keepInView(object, camera) {
      if (!mobile || !camera) return;
      projected.copy(object.position).project(camera);
      // Eight percent on either side preserves a reachable center even at the
      // closest pinch zoom. Preserve projected depth when bringing it inward.
      const x = clamp(projected.x, -.84, .84), y = clamp(projected.y, -.78, .78);
      if (x !== projected.x || y !== projected.y) {
        projected.x = x; projected.y = y;
        object.position.copy(projected.unproject(camera));
      }
    }
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group();
      const base = new THREE.Vector3(Math.cos(angles[i]) * radii[i], heights[i], Math.sin(angles[i]) * radii[i]);
      group.position.copy(base);
      root.add(group);
      const mat = material(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uLight: { value: .35 }, uColor: { value: tintBlue.clone() } },
        vertexShader: 'varying vec3 vNormal;varying vec3 vView;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
        fragmentShader: 'precision highp float;varying vec3 vNormal;varying vec3 vView;uniform float uLight;uniform vec3 uColor;void main(){float f=pow(max(0.,1.-abs(dot(vNormal,vView))),1.6);float facet=.3+.7*abs(dot(normalize(vNormal),normalize(vec3(.3,.9,.5))));gl_FragColor=vec4(uColor*(.7+f*.65),(.34+facet*.38+f*.28)*uLight);}'
      }));
      const core = new THREE.Mesh(crystalGeometry, mat);
      core.scale.set(1, 1.55, 1);
      group.add(core);
      const halo = lightHalo(.86, tintBlue.clone());
      group.add(halo);
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.userData = { kind: 'star', index: i };
      group.add(hit);hits.push(hit);
      crystals.push({ group, base, core, halo, lit: false, light: .35, tapped: -Infinity });
    }

    const linkPositions = new Float32Array(5 * 2 * 3);
    const linkColors = new Float32Array(5 * 2 * 3);
    const linkGeometry = geometry(new THREE.BufferGeometry());
    linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
    linkGeometry.setAttribute('color', new THREE.BufferAttribute(linkColors, 3));
    const links = new THREE.LineSegments(linkGeometry, material(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })));
    links.frustumCulled = false;
    root.add(links);

    const moonHit = new THREE.Mesh(geometry(new THREE.SphereGeometry(1.3, 16, 12)), hitMaterial);
    moonHit.position.set(-4, 3.3, -7);
    moonHit.userData = { kind: 'moon', index: 0 };
    root.add(moonHit);hits.push(moonHit);

    // A softly animated light butterfly is the portrait portal's spatial affordance.
    const butterfly = new THREE.Group();
    butterfly.position.set(mobile ? 1.72 : 2.1, 1.4, -.1);
    root.add(butterfly);
    const portalHalo = lightHalo(1.25, new THREE.Color('#b1c5ff'));
    butterfly.add(portalHalo);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(.01, .04);
    wingShape.bezierCurveTo(.2, .34, .52, .48, .43, .13);
    wingShape.bezierCurveTo(.39, -.02, .23, -.01, .14, -.04);
    wingShape.bezierCurveTo(.4, -.1, .24, -.34, .12, -.22);
    wingShape.bezierCurveTo(.05, -.17, .025, -.08, .01, .04);
    const wingGeometry = geometry(new THREE.ShapeGeometry(wingShape, 24));
    const wingMaterial = material(new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uLight: { value: .9 } },
      vertexShader: 'varying vec2 vLocal;void main(){vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `precision highp float;varying vec2 vLocal;uniform float uLight;
        void main(){float nearBody=exp(-vLocal.x*7.);
          float filament=pow(.5+.5*sin(atan(vLocal.y,vLocal.x)*32.+length(vLocal)*12.),16.);
          vec3 c=mix(vec3(.46,.59,1.),vec3(.92,.88,1.),nearBody);
          gl_FragColor=vec4(c,(.12+nearBody*.55+filament*.33)*uLight);}`
    }));
    const wingOutline = geometry(new THREE.BufferGeometry().setFromPoints(wingShape.getPoints(40).map(p => new THREE.Vector3(p.x, p.y, .004))));
    const veinMaterial = material(new THREE.LineBasicMaterial({ color: '#b6d7ff', transparent: true, opacity: .77, blending: THREE.AdditiveBlending, depthWrite: false }));
    const wings = [];
    [-1, 1].forEach(side => {
      const group = new THREE.Group();group.scale.x = side;
      group.add(new THREE.Mesh(wingGeometry, wingMaterial));
      group.add(new THREE.LineLoop(wingOutline, veinMaterial));
      butterfly.add(group);wings.push(group);
    });
    const bodyMesh = new THREE.Mesh(geometry(new THREE.CylinderGeometry(.012, .02, .25, 6)), material(new THREE.MeshBasicMaterial({ color: '#f4dfbb', transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })));
    butterfly.add(bodyMesh);
    const antenna = geometry(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.075,.24,.01),new THREE.Vector3(0,.1,.01),new THREE.Vector3(.075,.24,.01)
    ]));
    butterfly.add(new THREE.Line(antenna, veinMaterial));
    const portalHit = new THREE.Mesh(geometry(new THREE.SphereGeometry(mobile ? .5 : .43, 12, 8)), hitMaterial);
    portalHit.userData = { kind: 'portal', index: 0 };
    butterfly.add(portalHit);hits.push(portalHit);

    // Every meteor is a perspective-correct luminous streak with a fading tail.
    const meteorCount = mobile ? 12 : 24;
    const tailSteps = 12, segmentVertices = (tailSteps - 1) * 2;
    const meteorPositions = new Float32Array(meteorCount * segmentVertices * 3);
    const meteorAlpha = new Float32Array(meteorCount * segmentVertices);
    const meteorSeeds = new Float32Array(meteorCount * segmentVertices);
    const meteorGeometry = geometry(new THREE.BufferGeometry());
    meteorGeometry.setAttribute('position',new THREE.BufferAttribute(meteorPositions,3));
    meteorGeometry.setAttribute('aAlpha',new THREE.BufferAttribute(meteorAlpha,1));
    meteorGeometry.setAttribute('aTint',new THREE.BufferAttribute(meteorSeeds,1));
    const meteorMaterial = material(new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute float aAlpha,aTint;varying float vAlpha,vTint;void main(){vAlpha=aAlpha;vTint=aTint;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'precision highp float;varying float vAlpha,vTint;void main(){vec3 c=mix(vec3(.52,.72,1.),vec3(1.,.85,.66),vTint);gl_FragColor=vec4(c,vAlpha);}'
    }));
    const meteorLines = new THREE.LineSegments(meteorGeometry, meteorMaterial);
    meteorLines.frustumCulled = false;root.add(meteorLines);
    const headsPosition = new Float32Array(meteorCount * 3), headsLife = new Float32Array(meteorCount);
    const headGeometry = geometry(new THREE.BufferGeometry());
    headGeometry.setAttribute('position', new THREE.BufferAttribute(headsPosition,3));
    headGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(headsLife,1));
    const headMaterial = material(new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{uRatio:{value:1}},
      vertexShader:'attribute float aAlpha;uniform float uRatio;varying float vAlpha;void main(){vAlpha=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(65./max(2.,-mv.z),2.,8.)*uRatio;}',
      fragmentShader:'precision highp float;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.86,.93,1.,exp(-d*d*4.)*(1.-smoothstep(.65,1.,d))*vAlpha);}'
    }));
    const meteorHeads = new THREE.Points(headGeometry, headMaterial);meteorHeads.frustumCulled=false;root.add(meteorHeads);
    const meteors = Array.from({length:meteorCount},()=>({active:false,start:0,duration:2,origin:new THREE.Vector3(),velocity:new THREE.Vector3(),tail:3.6,tint:0}));
    function launchMeteor(time, delay, strong) {
      const i = meteorCursor++ % meteorCount, meteor = meteors[i];
      meteor.active=true;meteor.start=time+(delay||0);meteor.duration=2.05+Math.random()*.65;
      meteor.origin.set(-1+Math.random()*14,3+Math.random()*5.7,-5-Math.random()*15);
      meteor.velocity.set(-4.8-Math.random()*2.5,-1.6-Math.random()*1.2,.3+Math.random()*.4);
      meteor.tail=strong?4.3:3.3;meteor.tint=Math.random()>.7?1:0;
      for(let j=0;j<segmentVertices;j++)meteorSeeds[i*segmentVertices+j]=meteor.tint;
      meteorGeometry.attributes.aTint.needsUpdate=true;
    }
    function meteorShower(time, strength) {
      if(disposed)return;
      const t=Number.isFinite(time)?time:lastTime;
      const count=reduced?3:Math.min(meteorCount,Math.round((mobile?10:19)*clamp(strength==null?1:strength,.25,1.5)));
      for(let i=0;i<count;i++)launchMeteor(t,i*.09+Math.random()*.15,true);
      nextAmbient=t+9;
    }

    function updateMeteors(time) {
      for(let i=0;i<meteorCount;i++){
        const m=meteors[i],age=time-m.start;
        const alive=m.active&&age>=0&&age<m.duration;
        const opacity=alive?Math.min(1,age*6)*Math.min(1,(m.duration-age)*2.7):0;
        headsLife[i]=opacity;
        if(alive){
          const speedScale=reduced?.26:1;
          const hx=m.origin.x+m.velocity.x*age*speedScale,hy=m.origin.y+m.velocity.y*age*speedScale,hz=m.origin.z+m.velocity.z*age*speedScale;
          headsPosition.set([hx,hy,hz],i*3);
          const vLength=m.velocity.length();
          for(let j=0;j<tailSteps-1;j++)for(let endpoint=0;endpoint<2;endpoint++){
            const u=(j+endpoint)/(tailSteps-1),vertex=i*segmentVertices+j*2+endpoint,p=vertex*3;
            const length=u*m.tail*(reduced?.45:1);
            meteorPositions[p]=hx-m.velocity.x/vLength*length;
            meteorPositions[p+1]=hy-m.velocity.y/vLength*length;
            meteorPositions[p+2]=hz-m.velocity.z/vLength*length;
            meteorAlpha[vertex]=opacity*Math.pow(1-u,1.6)*.95;
          }
        } else {
          meteorAlpha.fill(0,i*segmentVertices,(i+1)*segmentVertices);
          if(age>=m.duration)m.active=false;
        }
      }
      meteorGeometry.attributes.position.needsUpdate=true;meteorGeometry.attributes.aAlpha.needsUpdate=true;
      headGeometry.attributes.position.needsUpdate=true;headGeometry.attributes.aAlpha.needsUpdate=true;
    }

    function collectCrystal(index,time) {
      if(disposed||!Number.isInteger(index)||index<0||index>=crystals.length)return null;
      const t=Number.isFinite(time)?time:lastTime;
      root.updateMatrixWorld(true);
      const crystal=crystals[index];
      const point=crystal.group.getWorldPosition(new THREE.Vector3());
      crystal.tapped=t;crystal.lit=true;
      const allLit=crystals.every(s=>s.lit);
      if(allLit&&!completed){
        completed=true;completeAt=t;meteorShower(t,1.2);
        if(typeof options.onComplete==='function')options.onComplete(point.clone());
      }
      return {kind:'star',index,point,lit:true,completed:allLit};
    }

    function pick(raycaster,time) {
      if(disposed)return null;
      root.updateMatrixWorld(true);
      const intersections=raycaster.intersectObjects(hits,false);
      if(!intersections.length)return null;
      const hit=intersections[0],info=hit.object.userData,t=Number.isFinite(time)?time:lastTime;
      const point=hit.object.getWorldPosition(new THREE.Vector3());
      if(info.kind==='portal'){
        // Keep double taps from repeatedly reopening the same apparition.
        if(t-portalAt>.65){portalAt=t;if(typeof options.onPortal==='function')options.onPortal(point.clone());}
        return {kind:'portal',index:0,point};
      }
      if(info.kind==='moon'){
        if(t-moonAt>1.4){moonAt=t;if(typeof options.onMoon==='function')options.onMoon(point.clone());}
        return {kind:'moon',index:0,point};
      }
      return collectCrystal(info.index,t);
    }

    return {
      root,
      pick,
      activate:collectCrystal,
      meteorShower,
      getProgress(){return crystals.filter(s=>s.lit).length;},
      resize(ratio){pixelRatio=Math.min(ratio||1,mobile?1.5:1.8);headMaterial.uniforms.uRatio.value=pixelRatio;},
      update(time,dt,state){
        if(disposed)return;state=state||{};lastTime=time;
        reduced=state.reducedMotion==null?!!options.reducedMotion:!!state.reducedMotion;
        const delta=clamp(dt||0,0,.06);motionTime+=reduced?0:delta;
        const energy=clamp(state.energy||0,0,1);
        if(mobile&&state.camera)state.camera.updateMatrixWorld(true);
        if(completed&&time-completeAt>8){completed=false;crystals.forEach(s=>{s.lit=false;s.tapped=-Infinity;});}
        for(let i=0;i<crystals.length;i++){
          const s=crystals[i],touchAge=time-s.tapped;
          s.group.position.copy(s.base);s.group.position.y+=Math.sin(motionTime*.8+i*1.3)*.075;
          keepInView(s.group,state.camera);
          const scale=1+Math.sin(motionTime*1.15+i)*.06+energy*.13;
          s.group.scale.setScalar(scale);
          s.core.rotation.set(motionTime*.18+i,motionTime*.36+i*.7,.2);
          const pulse=touchAge>=0&&touchAge<1.2?Math.sin(touchAge/1.2*Math.PI)*.8:0;
          const desired=s.lit?1.25:.48;
          s.light+=(desired-s.light)*(1-Math.exp(-delta*7));
          s.core.material.uniforms.uLight.value=s.light+pulse;
          s.core.material.uniforms.uColor.value.copy(tintBlue).lerp(tintGold,s.lit?.65:0);
          s.halo.material.uniforms.uLight.value=s.light*.9+pulse+energy*.28;
          s.halo.material.uniforms.uColor.value.copy(s.core.material.uniforms.uColor.value);
          const next=crystals[(i+1)%crystals.length];
          const factor=s.lit&&next.lit?.72:.12;
          const color=completed?tintGold:blue;
          for(let j=0;j<2;j++){linkColors[i*6+j*3]=color.r*factor;linkColors[i*6+j*3+1]=color.g*factor;linkColors[i*6+j*3+2]=color.b*factor;}
        }
        for(let i=0;i<crystals.length;i++){
          crystals[i].group.position.toArray(linkPositions,i*6);
          crystals[(i+1)%crystals.length].group.position.toArray(linkPositions,i*6+3);
        }
        linkGeometry.attributes.position.needsUpdate=true;linkGeometry.attributes.color.needsUpdate=true;
        butterfly.position.y=1.4+Math.sin(motionTime*.66)*.11;
        butterfly.position.x=(mobile?1.72:2.1)+Math.sin(motionTime*.3)*.06;
        butterfly.position.z=-.1;
        keepInView(butterfly,state.camera);
        if(state.camera)butterfly.quaternion.copy(state.camera.quaternion);
        wings[0].rotation.y=Math.sin(motionTime*4.7)*.55;
        wings[1].rotation.y=-Math.sin(motionTime*4.7)*.55;
        const portalPulse=Math.max(0,1-(time-portalAt)/1.6);
        portalHalo.material.uniforms.uLight.value=.43+energy*.4+portalPulse*.9;
        wingMaterial.uniforms.uLight.value=.9+portalPulse*.6;
        if(!reduced&&time>nextAmbient){launchMeteor(time,0,false);nextAmbient=time+6.5+Math.random()*3;}
        updateMeteors(time);
      },
      dispose(){
        if(disposed)return;disposed=true;scene.remove(root);
        geometrySet.forEach(g=>g.dispose());materialSet.forEach(m=>m.dispose());root.clear();
      }
    };
  };
})();
