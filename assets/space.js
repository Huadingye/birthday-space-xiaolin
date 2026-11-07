(function () {
  'use strict';
  const canvas = document.getElementById('space');
  const fallback = document.getElementById('fallback');
  const body = document.body;
  const hint = document.getElementById('gesture-hint');
  const cursor = document.getElementById('cursor');
  const status = document.getElementById('status');
  const gestureRibbon = document.getElementById('gesture-ribbon');
  const ribbonGlow = gestureRibbon.querySelector('.ribbon-halo');
  const ribbonCore = gestureRibbon.querySelector('.ribbon-core');
  const soundButton = document.getElementById('sound');
  const motionButton = document.getElementById('motion');
  const captureButton = document.getElementById('capture');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  let reduced = preference.matches, paused = false, hidden = document.hidden;
  let renderer, world, camera, atmosphere, sculpture, material, reflectionMaterial, reflection, lightGroup;
  let composer = null, isFallback = false, context2d = null;
  let dedication=null, encounters=null, portrait=null, portraitOpacity=0, portraitUntil=-1;
  let width = innerWidth, height = innerHeight, dpr = 1;
  let clock = 0, previous = 0, frameId = 0, mode = 'arrival', age = 0;
  let charge = 0, scatter = 0, morph = 0, intro = 0, halo = 0;
  let yaw = 0, pitch = .18, targetYaw = 0, targetPitch = .18, zoom = 1;
  let targetZoom = 1, pointerX = 0, pointerY = 0, keyboardHold = false;
  const pointers = new Map();
  let pinchDistance = 0, activeGesture = null, pulseIndex = 0;
  let lastTouch = -10, celebrationFire = -1;
  let returnMorph = 0, returnScatter = 0;
  let messageBlend=0, act='name', lastTap=-10, lastTapX=0,lastTapY=0;
  let wishVolleys=-1, nextPhotoAt=0;
  let fallbackPortrait=null;
  const touchWave={x:.5,y:.5,time:-100};
  const fallbackStars=Array.from({length:5},(_,i)=>({lit:false,x:0,y:0,index:i}));
  const fallbackButterfly={x:0,y:0};
  const fallbackMoon={x:0,y:0};
  const fallbackMeteors=[];
  const ribbonPoints=[];
  let fallbackResetAt=-1,fallbackNextMeteor=0,fallbackMoonPulseUntil=-1,lastRibbonAt=-10;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const announce = text => { status.textContent = text; };
  const THREE = window.THREE;
  let data, pulses, raycaster, hitPlane, floorPlane, hitPoint;
  const transient = [];

  function makeMaterial(reflected) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uCharge: { value: 0 }, uScatter: { value: 0 },
        uMorph: { value: 0 }, uIntro: { value: 0 }, uRatio: { value: dpr },
        uFacing: { value: 0 },
        uMessageBlend:{value:0},uPortrait:{value:0},
        uReflection: { value: reflected ? 1 : 0 }, uMotion: { value: reduced ? 0 : 1 },
        uPulses: { value: pulses }
      },
      vertexShader: `
        uniform float uTime, uCharge, uScatter, uMorph, uIntro, uRatio, uReflection, uMotion, uFacing,uMessageBlend,uPortrait;
        uniform vec4 uPulses[4];
        attribute vec3 aTarget, aWish, aBurst;
        attribute vec3 aColor;
        attribute float aSeed, aType;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 target = mix(aTarget,aWish,uMessageBlend);
          target.xz = mat2(cos(uFacing),-sin(uFacing),sin(uFacing),cos(uFacing))*target.xz;
          vec3 p = mix(position, target, uMorph);
          p *= 1.0 - uCharge * .09;
          float wind = sin(uTime * .62 + aSeed * 32.0);
          p.x += wind * .007 * uMotion;
          p.y += cos(uTime * .9 + aSeed * 42.0) * .006 * uMotion;
          if (aType > 1.5) {
            p.x += sin(uTime * 8.0 + aSeed * 7.0) * .016 * (1.0-uMorph) * uMotion;
            p.y += abs(sin(uTime * 5.0 + aSeed * 5.0)) * .04 * (1.0-uMorph) * uMotion;
          }
          for (int i=0; i<4; i++) {
            float age = uTime - uPulses[i].z;
            if (age > 0.0 && age < 1.8) {
              vec2 diff = p.xy - uPulses[i].xy;
              float d = length(diff);
              float offset=(d-age*2.8)*3.5;
              float ring = exp(-offset*offset) * (1.0-age/1.8);
              p.xy += normalize(diff+vec2(.001)) * ring * .13 * uPulses[i].w;
            }
          }
          float swirl = uScatter * 1.4;
          vec3 fly = aBurst;
          fly.xz = mat2(cos(swirl),-sin(swirl),sin(swirl),cos(swirl))*fly.xz;
          p += fly * uScatter;
          p += aBurst * (1.0-uIntro) * .45;
          p.y += .035 * sin(uTime*.7) * uMotion * (1.0-uMorph);
          if (uReflection > .5) {
            p.y = -2.78 - p.y;
            p.x += sin(p.z*6.0+uTime*.5)*.025*uMotion;
          }
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * mv;
          float pointSize = (aType > 1.5 ? 4.4 : 1.2 + aSeed*1.25 + aType*.3);
          gl_PointSize = clamp(pointSize * uRatio * 7.5 / max(1.5,-mv.z), 0.7, 13.0*uRatio);
          vColor = mix(aColor,vec3(.76,.88,1.0), uMorph*.65);
          vColor *= 1.0 + uCharge*.5;
          vAlpha = (.48+aSeed*.42) * (.7+.3*uIntro);
          vAlpha *= 1.0 - uMorph*.35;
          vAlpha *= 1.0 - uReflection*.85;
          vAlpha *= 1.0 - clamp(uScatter*.18,0.0,.8);
          vAlpha *= 1.0-uPortrait*.75;
        }`,
      fragmentShader: `
        precision highp float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord-.5)*2.0;
          if (d>1.0) discard;
          float a = exp(-d*d*4.0) * (1.0-smoothstep(.65,1.0,d));
          gl_FragColor=vec4(vColor,a*vAlpha);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
  }

  function createBloom() {
    const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    const blurA = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const blurB = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
    const postWorld = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const vertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}';
    const blurMaterial = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null }, uDirection: { value: new THREE.Vector2() }, uThreshold: { value: 0 } },
      vertexShader: vertex,
      fragmentShader: `precision highp float;
        uniform sampler2D uMap; uniform vec2 uDirection; uniform float uThreshold; varying vec2 vUv;
        vec3 sampleLight(vec2 uv){vec3 c=texture2D(uMap,uv).rgb; float l=max(max(c.r,c.g),c.b); return c*smoothstep(uThreshold,uThreshold+.25,l);}
        void main(){vec3 c=sampleLight(vUv)*.227027;
          c+=sampleLight(vUv+uDirection*1.384615)*.316216;
          c+=sampleLight(vUv-uDirection*1.384615)*.316216;
          c+=sampleLight(vUv+uDirection*3.230769)*.070270;
          c+=sampleLight(vUv-uDirection*3.230769)*.070270;
          gl_FragColor=vec4(c,1.0);}`,
      depthTest: false, depthWrite: false
    });
    const finalMaterial = new THREE.ShaderMaterial({
      uniforms: { uScene: { value: sceneTarget.texture }, uGlow: { value: blurB.texture }, uEnergy: { value: 0 },uTouch:{value:new THREE.Vector2(.5,.5)},uWave:{value:10},uAspect:{value:1},uMotion:{value:1} },
      vertexShader: vertex,
      fragmentShader: `precision highp float;
        uniform sampler2D uScene,uGlow; uniform float uEnergy,uWave,uAspect,uMotion; uniform vec2 uTouch; varying vec2 vUv;
        void main(){vec2 delta=(vUv-uTouch)*vec2(uAspect,1.);float d=length(delta);
          float offset=(d-uWave*.32)*14.;
          float ripple=sin(d*65.-uWave*12.)*exp(-offset*offset)*max(0.,1.-uWave*.6)*uMotion;
          vec2 uv=clamp(vUv+normalize(delta+vec2(.0001))*ripple*.006,vec2(.002),vec2(.998));
          vec3 c=texture2D(uScene,uv).rgb;
          float prism=uEnergy*.0018*uMotion;
          c.r=texture2D(uScene,clamp(uv+vec2(prism,0.),vec2(.002),vec2(.998))).r;
          c.b=texture2D(uScene,clamp(uv-vec2(prism,0.),vec2(.002),vec2(.998))).b;
          c+=texture2D(uGlow,uv).rgb*(.75+uEnergy*.65);
          float vig=1.0-smoothstep(.2,.82,length((uv-.5)*vec2(1.0,.8)))*.3;
          c*=vig; gl_FragColor=vec4(c,1.0);}`,
      depthTest: false, depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial);
    postWorld.add(quad);
    return {
      resize(w, h) {
        sceneTarget.setSize(Math.round(w*dpr), Math.round(h*dpr));
        blurA.setSize(Math.max(1,Math.round(w*dpr*.5)),Math.max(1,Math.round(h*dpr*.5)));
        blurB.setSize(blurA.width,blurA.height);
      },
      render() {
        renderer.setRenderTarget(sceneTarget); renderer.render(world,camera);
        quad.material=blurMaterial;
        blurMaterial.uniforms.uMap.value=sceneTarget.texture;
        blurMaterial.uniforms.uDirection.value.set(2/blurA.width,0);
        blurMaterial.uniforms.uThreshold.value=.38;
        renderer.setRenderTarget(blurA);renderer.render(postWorld,postCamera);
        blurMaterial.uniforms.uMap.value=blurA.texture;
        blurMaterial.uniforms.uDirection.value.set(0,2/blurA.height);
        blurMaterial.uniforms.uThreshold.value=0;
        renderer.setRenderTarget(blurB);renderer.render(postWorld,postCamera);
        finalMaterial.uniforms.uEnergy.value=charge;
        finalMaterial.uniforms.uTouch.value.set(touchWave.x,touchWave.y);
        finalMaterial.uniforms.uWave.value=Math.max(0,clock-touchWave.time);
        finalMaterial.uniforms.uAspect.value=width/height;
        finalMaterial.uniforms.uMotion.value=reduced?0:1;
        quad.material=finalMaterial;
        renderer.setRenderTarget(null);renderer.render(postWorld,postCamera);
      },
      dispose(){sceneTarget.dispose();blurA.dispose();blurB.dispose();quad.geometry.dispose();blurMaterial.dispose();finalMaterial.dispose();}
    };
  }

  const effectsCount = mobile ? 900 : 1800;
  let effects, effectPositions, effectColors, effectSizes, effectLife, effectVelocity, effectWrite = 0;
  function createEffects() {
    effectPositions = new Float32Array(effectsCount*3);
    effectColors = new Float32Array(effectsCount*3);
    effectSizes = new Float32Array(effectsCount);
    effectLife = new Float32Array(effectsCount);
    effectVelocity = new Float32Array(effectsCount*3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(effectPositions,3));
    geo.setAttribute('aColor',new THREE.BufferAttribute(effectColors,3));
    geo.setAttribute('aSize',new THREE.BufferAttribute(effectSizes,1));
    geo.setAttribute('aLife',new THREE.BufferAttribute(effectLife,1));
    const mat = new THREE.ShaderMaterial({
      uniforms:{uRatio:{value:dpr}}, transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:'attribute vec3 aColor;attribute float aSize,aLife;uniform float uRatio;varying vec3 vColor;varying float vLife;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*uRatio*8./max(2.,-mv.z);vColor=aColor;vLife=aLife;}',
      fragmentShader:'precision highp float;varying vec3 vColor;varying float vLife;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.||vLife<=0.)discard;gl_FragColor=vec4(vColor,exp(-d*d*3.)*(1.-smoothstep(.6,1.,d))*min(1.,vLife));}'
    });
    effects = new THREE.Points(geo,mat);effects.frustumCulled=false;world.add(effects);
  }
  const effectPalette = [[1,.69,.58],[1,.86,.58],[.63,.87,1],[.91,.65,.88]];
  function sparks(point, count=50, speed=1.8) {
    if (reduced) { count = Math.min(count,14);speed*=.2; }
    if (isFallback) {
      for(let j=0;j<count;j++) transient.push({x:point.x,y:point.y,z:point.z,vx:(Math.random()-.5)*speed,vy:(Math.random()-.3)*speed,vz:(Math.random()-.5)*speed,life:1.6,color:effectPalette[j%4]});
      return;
    }
    for(let n=0;n<count;n++) {
      const i=effectWrite++%effectsCount,p=i*3;
      const a=Math.random()*Math.PI*2,b=Math.random()*2-1,s=Math.sqrt(1-b*b),v=(.3+Math.random())*speed;
      effectPositions[p]=point.x;effectPositions[p+1]=point.y;effectPositions[p+2]=point.z;
      effectVelocity[p]=Math.cos(a)*s*v;effectVelocity[p+1]=b*v;effectVelocity[p+2]=Math.sin(a)*s*v;
      effectLife[i]=1.3+Math.random()*1.1;effectSizes[i]=2+Math.random()*3;
      effectColors.set(effectPalette[n%effectPalette.length],p);
    }
    effects.geometry.attributes.aColor.needsUpdate=true;effects.geometry.attributes.aSize.needsUpdate=true;
  }
  function updateEffects(dt) {
    if(!effects) return;
    const drag=Math.exp(-dt*.85);
    for(let i=0;i<effectsCount;i++) {
      if(effectLife[i]<=0)continue;
      const p=i*3;
      effectLife[i]-=dt;
      effectVelocity[p]*=drag;effectVelocity[p+1]=effectVelocity[p+1]*drag-dt*.25;effectVelocity[p+2]*=drag;
      for(let k=0;k<3;k++)effectPositions[p+k]+=effectVelocity[p+k]*dt;
    }
    effects.geometry.attributes.position.needsUpdate=true;effects.geometry.attributes.aLife.needsUpdate=true;
  }

  function initializeScene() {
    if (!THREE || !window.createBirthdaySculpture) throw new Error('本地场景资源缺失');
    data = window.createBirthdaySculpture(THREE,mobile);
    pulses=Array.from({length:4},()=>new THREE.Vector4(0,0,-100,0));
    renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:!mobile,powerPreference:'high-performance'});
    renderer.setClearColor(0x030610,1);
    renderer.outputEncoding=THREE.LinearEncoding;
    world=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(44,width/height,.1,140);
    if(window.createBirthdayDedication){
      dedication=window.createBirthdayDedication(THREE,world,{mobile,count:data.count});
      data.targets=dedication.targets.name;
      data.wishTargets=dedication.targets.wish;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    geo.setAttribute('aColor',new THREE.BufferAttribute(data.colors,3));
    geo.setAttribute('aTarget',new THREE.BufferAttribute(data.targets,3));
    geo.setAttribute('aWish',new THREE.BufferAttribute(data.wishTargets||data.targets,3));
    geo.setAttribute('aBurst',new THREE.BufferAttribute(data.burst,3));
    geo.setAttribute('aSeed',new THREE.BufferAttribute(data.seeds,1));
    geo.setAttribute('aType',new THREE.BufferAttribute(data.types,1));
    material=makeMaterial(false);reflectionMaterial=makeMaterial(true);
    sculpture=new THREE.Points(geo,material);sculpture.frustumCulled=false;world.add(sculpture);
    reflection=new THREE.Points(geo,reflectionMaterial);reflection.frustumCulled=false;world.add(reflection);
    lightGroup=new THREE.Group();world.add(lightGroup);
    const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;
    const gx=glowCanvas.getContext('2d'),gradient=gx.createRadialGradient(32,32,0,32,32,32);
    gradient.addColorStop(0,'rgba(255,244,217,1)');gradient.addColorStop(.13,'rgba(255,199,126,.6)');gradient.addColorStop(.4,'rgba(249,139,105,.13)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    gx.fillStyle=gradient;gx.fillRect(0,0,64,64);
    const texture=new THREE.CanvasTexture(glowCanvas);
    data.candles.forEach(p=>{
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.65}));
      sprite.position.copy(p);sprite.scale.set(.36,.5,1);lightGroup.add(sprite);
    });
    atmosphere=window.createBirthdayAtmosphere ? window.createBirthdayAtmosphere(THREE,world,{mobile,reducedMotion:reduced}) : null;
    createEffects();
    if(window.createBirthdayEncounters)encounters=window.createBirthdayEncounters(THREE,world,{
      mobile,reducedMotion:reduced,
      onComplete(){if(['idle','charging'].includes(mode))celebrate();else shower();announce('星点已全部点亮，送给小林子的生日星座已完成。');},
      onPortal(){showPortrait();},
      onMoon(){
        if(atmosphere){atmosphere.flash(1.5);atmosphere.pulse(-4,-7,clock,1.7);}
        if(encounters)encounters.meteorShower(clock,.85);
        hideHint();announce('月光回应了这次触碰。');
      }
    });
    if(window.createBirthdayPortrait)portrait=window.createBirthdayPortrait(THREE,world,{mobile});
    composer=createBloom();
    raycaster=new THREE.Raycaster();
    hitPlane=new THREE.Plane(new THREE.Vector3(0,0,1),0);
    floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),1.39);
    hitPoint=new THREE.Vector3();
    resize();
  }

  function startFallback(error) {
    isFallback=true;body.classList.add('is-fallback');body.classList.add('is-ready');
    fallback.hidden=false;context2d=fallback.getContext('2d');
    if (!data && THREE && window.createBirthdaySculpture) data=window.createBirthdaySculpture(THREE,true);
    if(data&&!data.wishTargets&&window.createBirthdayDedication){
      try{dedication=window.createBirthdayDedication(THREE,new THREE.Scene(),{mobile:true,count:data.count});data.targets=dedication.targets.name;data.wishTargets=dedication.targets.wish;}catch(_){}
    }
    if(window.OC_PORTRAIT_DATA_URL&&typeof Image!=='undefined'){
      fallbackPortrait=new Image();fallbackPortrait.src=window.OC_PORTRAIT_DATA_URL;
    }
    if(!data) {
      announce('场景资源未能加载，请保留 assets 文件夹与 HTML 在同一目录。');
    } else announce('已切换至轻量粒子空间，仍可拖动和长按。');
    console.warn('Using the Canvas particle space.',error);
    resize();
  }

  function setMode(next) {
    if(next==='return'){returnMorph=morph;returnScatter=scatter;}
    mode=next;age=0;
    body.classList.toggle('is-charging',next==='charging');
    body.classList.toggle('is-celebrating',['scatter','gather','constellation','inscription','finale','return'].includes(next));
  }
  function celebrate() {
    if(!['idle','charging'].includes(mode))return;
    act='name';messageBlend=0;portraitUntil=-1;
    setMode('scatter');celebrationFire=-1;keyboardHold=false;
    if(activeGesture)activeGesture.celebrated=true;
    hideHint();playChime(0);
    announce('星尘正在写出小林子的名字。祝：小林子17岁生日快乐。');
    if(encounters)encounters.meteorShower(clock,1.2);
    sparks({x:0,y:.7,z:0},mobile?180:320,3.3);
    if(atmosphere&&atmosphere.pulse)atmosphere.pulse(0,0,clock);
  }
  function reset() {
    if(mode==='arrival')return;
    keyboardHold=false;activeGesture=null;charge=0;
    setMode('return');hideHint();
  }
  function updateState(dt) {
    age+=dt;
    if(mode==='arrival') {intro=easeOut(age/(reduced?.2:2.4));if(intro===1)setMode('idle');}
    if(activeGesture&&!activeGesture.moved&&!activeGesture.celebrated&&pointers.size===1&&mode==='idle'&&clock-activeGesture.start>.3) setMode('charging');
    if(mode==='charging') {
      const holding=keyboardHold||(activeGesture&&!activeGesture.moved&&pointers.size===1);
      if(holding){charge=clamp(charge+dt*.85,0,1);if(charge===1)celebrate();}
      else {charge=Math.max(0,charge-dt*3);if(charge===0)setMode('idle');}
    } else charge=Math.max(0,charge-dt*1.8);
    if(mode==='scatter') {
      scatter=easeOut(age/(reduced?.25:1.35))*(reduced?.09:1);
      morph=0;
      const volley=Math.floor(age/.34);
      if(volley>celebrationFire&&volley<5){celebrationFire=volley;const angle=volley*2.4;sparks({x:Math.sin(angle)*3.4,y:.6+Math.random()*1.7,z:Math.cos(angle)*2.3},mobile?65:110,2);}
      if(age>(reduced?.4:1.8))setMode('gather');
    } else if(mode==='gather') {
      const t=smooth(age/(reduced?.5:2.1));scatter=(1-t)*(reduced?.09:1);morph=t;
      if(t===1){setMode('constellation');playChime(1);}
    } else if(mode==='constellation') {
      morph=1;scatter=0;
      if(age>(reduced?1.5:2.6)){act='wish';setMode('inscription');}
    } else if(mode==='inscription') {
      messageBlend=smooth(age/(reduced?.5:2.2));
      if(messageBlend===1){setMode('finale');wishVolleys=-1;shower();announce('祝：小林子17岁生日快乐。');}
    } else if(mode==='finale') {
      const volley=Math.floor(age/(reduced?2:1.05));
      if(volley>wishVolleys&&volley<6){
        wishVolleys=volley;const angle=volley*2.4;
        sparks({x:Math.sin(angle)*3.5,y:1.2+Math.random()*1.8,z:Math.cos(angle)*2-1},mobile?95:180,2.8);
        if(atmosphere)atmosphere.pulse(Math.sin(angle)*2,Math.cos(angle)*2,clock,.8);
      }
      if(age>(reduced?5:7.5))setMode('return');
    } else if(mode==='return') {
      const t=smooth(age/(reduced?.7:2.6));
      morph=returnMorph*(1-t);scatter=returnScatter*(1-t);
      if(t===1){morph=0;scatter=0;messageBlend=0;act='name';setMode('idle');announce('蛋糕重新汇聚，可以点亮星点，或触碰光蝶。');}
    }
    cursor.style.setProperty('--charge',charge.toFixed(3));
    halo=mix(halo,charge+scatter*.5,1-Math.exp(-dt*3));
    const portraitTarget=clock<portraitUntil?1:0;
    portraitOpacity=mix(portraitOpacity,portraitTarget,1-Math.exp(-dt*(reduced?8:2.7)));
  }

  function shower(){
    if(isFallback)addFallbackMeteors(reduced?2:14);
    if(encounters)encounters.meteorShower(clock,reduced?.25:1.5);
    for(let i=0;i<(reduced?2:5);i++)sparks({x:(i-2)*1.5,y:2+Math.random()*1.5,z:-1},mobile?45:90,1.8);
    playChime(1);hideHint();announce('流星雨正在穿过生日星空。');
  }
  function showPortrait(){
    if(portrait&&portrait.failed){announce('角色素材暂未加载，星空互动仍可继续。');return;}
    portraitUntil=portraitOpacity>.5?-1:clock+11;
    sparks({x:mobile?0:2.8,y:.8,z:0},mobile?100:180,1.5);
    playChime(1);hideHint();announce('光蝶唤醒了角色幻影。');
  }

  function tapObject(x,y){
    let picked=null;
    if(isFallback){
      const star=fallbackStars.find(s=>Math.hypot(x-s.x,y-s.y)<27);
      if(star){activateFallbackStar(star.index);picked=star;}
      else if(Math.hypot(x-fallbackButterfly.x,y-fallbackButterfly.y)<32){showPortrait();picked=fallbackButterfly;}
      else if(Math.hypot(x-fallbackMoon.x,y-fallbackMoon.y)<30){
        fallbackMoonPulseUntil=clock+2.2;addFallbackMeteors(8);
        playChime(1);hideHint();announce('月光回应了这次触碰。');picked=fallbackMoon;
      }
    } else if(encounters&&raycaster){
      raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
      picked=encounters.pick(raycaster,clock);
      if(picked){sparks(picked.point||worldPoint(x,y),70,1.4);playChime(2);}
    }
    const tapTime=performance.now()/1000;
    if(!picked&&tapTime-lastTap<.34&&Math.hypot(x-lastTapX,y-lastTapY)<45){shower();lastTap=-10;}
    else {lastTap=picked?-10:tapTime;lastTapX=x;lastTapY=y;}
    touchSpace(x,y,true);
  }

  function hideHint(){hint.classList.add('is-hidden');}
  function addRibbonPoint(x,y){
    const last=ribbonPoints[ribbonPoints.length-1];
    if(last&&Math.hypot(x-last.x,y-last.y)<5)return;
    ribbonPoints.push({x,y,time:clock});
    if(ribbonPoints.length>48)ribbonPoints.shift();
  }
  function updateGestureRibbon(){
    const lifetime=reduced?.58:1.1;
    while(ribbonPoints.length&&clock-ribbonPoints[0].time>lifetime)ribbonPoints.shift();
    if(ribbonPoints.length<2){gestureRibbon.style.opacity='0';ribbonGlow.setAttribute('d','');ribbonCore.setAttribute('d','');return;}
    let path=`M ${ribbonPoints[0].x.toFixed(1)} ${ribbonPoints[0].y.toFixed(1)}`;
    for(let i=1;i<ribbonPoints.length;i++){
      const p=ribbonPoints[i],prev=ribbonPoints[i-1];
      const mx=(prev.x+p.x)*.5,my=(prev.y+p.y)*.5;
      path+=` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    const last=ribbonPoints[ribbonPoints.length-1];
    path+=` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
    ribbonGlow.setAttribute('d',path);ribbonCore.setAttribute('d',path);
    gestureRibbon.style.opacity=String(clamp(1-(clock-last.time)/(reduced?.48:.85),0,1));
  }
  function worldPoint(x,y,floor=false) {
    if(isFallback||!raycaster) {
      const scale=Math.min(width/5.4,height/5.3)/zoom;
      const sx=(x-width/2)/scale,sy=(height*.49-y)/scale;
      return {x:Math.cos(yaw)*sx+Math.sin(yaw)*Math.sin(pitch)*sy,y:Math.cos(pitch)*sy,z:Math.sin(yaw)*sx-Math.cos(yaw)*Math.sin(pitch)*sy};
    }
    raycaster.setFromCamera(new THREE.Vector2(x/width*2-1,1-y/height*2),camera);
    if(!floor)hitPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),new THREE.Vector3(0,.15,0));
    const p=raycaster.ray.intersectPlane(floor?floorPlane:hitPlane,hitPoint);
    return p&&p.length()<35 ? p.clone() : new THREE.Vector3(0,0,0);
  }
  function touchSpace(x,y,strong=false) {
    touchWave.x=x/width;touchWave.y=1-y/height;touchWave.time=clock;
    const p=worldPoint(x,y);
    sparks(p,strong?100:26,strong?2.2:.7);
    if(pulses)pulses[pulseIndex++%4].set(p.x,p.y,clock,strong?1.2:.65);
    if(atmosphere&&atmosphere.pulse){const f=worldPoint(x,y,true);atmosphere.pulse(f.x,f.z,clock);}
    if(strong)playChime(2);
  }
  function pointerDown(event) {
    if(event.button>0||paused)return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){
      activeGesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,start:clock,moved:false,celebrated:false};
      ribbonPoints.length=0;lastRibbonAt=clock;addRibbonPoint(event.clientX,event.clientY);
      touchSpace(event.clientX,event.clientY);hideHint();
    } else {
      if(activeGesture)activeGesture.moved=true;
      if(mode==='charging'){charge=0;setMode('idle');}
      const [a,b]=Array.from(pointers.values());pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);
    }
  }
  function pointerMove(event) {
    pointerX=event.clientX/width*2-1;pointerY=event.clientY/height*2-1;
    if(event.pointerType!=='touch'){cursor.classList.add('is-visible');cursor.style.transform=`translate(${event.clientX}px,${event.clientY}px)`;}
    if(paused||!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>1){const[a,b]=Array.from(pointers.values());const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance>0)targetZoom=clamp(targetZoom*pinchDistance/Math.max(10,d),.72,1.35);pinchDistance=d;return;}
    const g=activeGesture;if(!g||g.id!==event.pointerId)return;
    const dx=event.clientX-g.lastX,dy=event.clientY-g.lastY;
    if(Math.hypot(event.clientX-g.x,event.clientY-g.y)>9)g.moved=true;
    if(g.moved){
      targetYaw-=dx*.0045;targetPitch=clamp(targetPitch+dy*.003,-.04,.62);
      if(mode==='charging'){charge=0;setMode('idle');}
      if(clock-lastTouch>.045){sparks(worldPoint(event.clientX,event.clientY),4,.24);lastTouch=clock;}
      if(clock-lastRibbonAt>.012){addRibbonPoint(event.clientX,event.clientY);lastRibbonAt=clock;}
    }
    g.lastX=event.clientX;g.lastY=event.clientY;
  }
  function pointerUp(event,cancelled=false) {
    const g=activeGesture;pointers.delete(event.pointerId);
    if(g&&g.id===event.pointerId){
      if(cancelled){if(mode==='charging'){charge=0;setMode('idle');}}
      else if(!g.moved&&!g.celebrated){
        if(mode==='charging'&&charge>.28)celebrate();
        else {tapObject(event.clientX,event.clientY);if(mode==='charging'){charge=0;setMode('idle');}}
      }
      activeGesture=null;
    }
    if(pointers.size===1){
      const [id,remaining]=pointers.entries().next().value;
      activeGesture={id,x:remaining.x,y:remaining.y,lastX:remaining.x,lastY:remaining.y,start:clock,moved:true,celebrated:false};
      pinchDistance=0;
    } else if(!pointers.size)pinchDistance=0;
  }

  let audio=null,audioGain=null,audioOn=false;
  async function toggleSound() {
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext){announce('当前浏览器不支持声音。');return;}
    try {
      if(!audio){
        audio=new AudioContext();audioGain=audio.createGain();audioGain.gain.value=0;audioGain.connect(audio.destination);
        [130.81,196,261.63].forEach((f,i)=>{const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=f;gain.gain.value=i===0?.07:.035;osc.connect(gain);gain.connect(audioGain);osc.start();});
      }
      await audio.resume();audioOn=!audioOn;
      audioGain.gain.setTargetAtTime(audioOn&&!paused?.24:0,audio.currentTime,.4);
      soundButton.setAttribute('aria-pressed',String(audioOn));soundButton.setAttribute('aria-label',audioOn?'关闭声音':'开启声音');
      if(audioOn)playChime(1);
    } catch(error){announce('声音暂时无法开启，空间仍可正常互动。');}
  }
  function playChime(kind) {
    if(!audioOn||!audio||paused)return;
    const notes=kind===0?[523.25,659.25,783.99]:kind===1?[659.25,783.99,1046.5]:[523.25+Math.random()*90];
    notes.forEach((freq,i)=>{
      const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.15;
      osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.15,t+.015);gain.gain.exponentialRampToValueAtTime(.001,t+1.8);
      osc.connect(gain);gain.connect(audioGain);osc.start(t);osc.stop(t+1.9);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    });
  }
  function restoreAudio(){
    if(!audio||!audioOn||paused||hidden)return;
    audio.resume().then(()=>{
      if(audioGain)audioGain.gain.setTargetAtTime(audioOn&&!paused&&!hidden?.24:0,audio.currentTime,.2);
    }).catch(()=>{
      audioOn=false;soundButton.setAttribute('aria-pressed','false');soundButton.setAttribute('aria-label','开启声音');
      announce('轻触声音图标即可重新开启声音。');
    });
  }
  function togglePause() {
    paused=!paused;keyboardHold=false;pointers.clear();activeGesture=null;
    body.classList.toggle('is-paused',paused);motionButton.setAttribute('aria-pressed',String(paused));
    motionButton.setAttribute('aria-label',paused?'继续空间动画':'暂停空间动画');
    if(audioGain)audioGain.gain.setTargetAtTime(!paused&&audioOn?.24:0,audio.currentTime,.2);
    if(!paused)restoreAudio();
    previous=performance.now();schedule();
  }

  function resize() {
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,mobile?1.45:1.8);
    gestureRibbon.setAttribute('viewBox',`0 0 ${width} ${height}`);
    if(isFallback){fallback.width=Math.round(width*dpr);fallback.height=Math.round(height*dpr);context2d.setTransform(dpr,0,0,dpr,0,0);}
    else if(renderer){
      renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
      material.uniforms.uRatio.value=dpr;reflectionMaterial.uniforms.uRatio.value=dpr;
      effects.material.uniforms.uRatio.value=dpr;if(composer)composer.resize(width,height);
      if(atmosphere&&atmosphere.resize)atmosphere.resize(dpr);
      if(dedication)dedication.resize(width/height);
      if(encounters)encounters.resize(dpr);
    }
    schedule();
  }
  function activateFallbackStar(index){
    const star=fallbackStars[index];
    if(!star||star.lit)return;
    star.lit=true;touchSpace(star.x,star.y,true);playChime(2);
    if(fallbackStars.every(s=>s.lit)){
      fallbackResetAt=clock+8;
      if(['idle','charging'].includes(mode))celebrate();else shower();
      announce('星点已全部点亮，送给小林子的生日星座已完成。');
    }
  }
  function addFallbackMeteors(count){
    for(let i=0;i<count;i++)fallbackMeteors.push({x:Math.random()*1.5-.25,y:-.2-Math.random()*.65,life:1.7+Math.random()*1.5,speed:.27+Math.random()*.2});
    if(fallbackMeteors.length>45)fallbackMeteors.splice(0,fallbackMeteors.length-45);
  }
  function drawFallbackEncounters(ctx,dt,project){
    if(fallbackResetAt>0&&clock>=fallbackResetAt){fallbackStars.forEach(s=>s.lit=false);fallbackResetAt=-1;}
    if(!reduced&&clock>fallbackNextMeteor){addFallbackMeteors(1);fallbackNextMeteor=clock+6;}
    const positions=[[-1.9,.9,.1],[-1.55,-.8,0],[0,-1.7,.2],[1.5,-.85,0],[1.95,.55,.1]];
    fallbackStars.forEach((star,i)=>Object.assign(star,project(...positions[i])));
    ctx.save();ctx.lineWidth=1;
    fallbackMoon.x=width*.13;fallbackMoon.y=height*.2;
    const moonRadius=Math.max(11,Math.min(18,width*.038));
    ctx.shadowBlur=13;ctx.shadowColor='#d9e5ff';ctx.fillStyle='rgba(218,226,246,.74)';
    ctx.beginPath();ctx.arc(fallbackMoon.x,fallbackMoon.y,moonRadius,-1.2,1.2);
    ctx.arc(fallbackMoon.x+moonRadius*.48,fallbackMoon.y-moonRadius*.07,moonRadius*.83,1.2,-1.2,true);ctx.closePath();ctx.fill();
    if(clock<fallbackMoonPulseUntil){
      const age=2.2-(fallbackMoonPulseUntil-clock),radius=age*Math.min(width,height)*.18;
      ctx.globalAlpha=Math.max(0,1-age/2.2)*.5;ctx.beginPath();ctx.arc(fallbackMoon.x,fallbackMoon.y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
    for(let i=1;i<5;i++){
      const a=fallbackStars[i-1],b=fallbackStars[i];
      ctx.strokeStyle=a.lit&&b.lit?'rgba(175,210,255,.55)':'rgba(140,179,229,.1)';
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    fallbackStars.forEach((star,i)=>{
      const r=star.lit?10:7+(reduced?0:Math.sin(clock*1.7+i)*1.4);
      ctx.shadowBlur=star.lit?20:10;ctx.shadowColor='#9cbdff';
      ctx.fillStyle=star.lit?'#e4f1ff':'#8eaee4';ctx.beginPath();
      for(let k=0;k<8;k++){const a=k*Math.PI/4,rad=k%2?r*.35:r;const x=star.x+Math.cos(a)*rad,y=star.y+Math.sin(a)*rad;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();
    });
    Object.assign(fallbackButterfly,project(1.45,1.55,0));
    ctx.translate(fallbackButterfly.x,fallbackButterfly.y);
    ctx.fillStyle='rgba(185,199,255,.85)';ctx.shadowBlur=18;
    const flap=reduced?1:.7+Math.sin(clock*3)*.3;
    for(const direction of [-1,1]){
      ctx.save();ctx.scale(direction*flap,1);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(8,-18,23,-11,16,0);ctx.bezierCurveTo(24,14,4,17,0,0);ctx.fill();ctx.restore();
    }
    ctx.restore();ctx.save();
    ctx.lineWidth=1.4;ctx.strokeStyle='#b9d9ff';ctx.shadowColor='#9dbfff';ctx.shadowBlur=8;
    for(let i=fallbackMeteors.length-1;i>=0;i--){
      const m=fallbackMeteors[i];m.x-=dt*m.speed*.65;m.y+=dt*m.speed;m.life-=dt;
      ctx.globalAlpha=Math.min(1,Math.max(0,m.life))*.7;ctx.beginPath();ctx.moveTo(m.x*width,m.y*height);ctx.lineTo((m.x+.065)*width,(m.y-.09)*height);ctx.stroke();
      if(m.life<=0)fallbackMeteors.splice(i,1);
    }
    const waveAge=clock-touchWave.time;
    if(!reduced&&waveAge>=0&&waveAge<1.7){
      ctx.globalAlpha=(1-waveAge/1.7)*.3;ctx.lineWidth=.8;ctx.beginPath();ctx.arc(touchWave.x*width,(1-touchWave.y)*height,waveAge*Math.min(width,height)*.32,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  function drawFallback(dt) {
    const ctx=context2d;ctx.fillStyle='#040811';ctx.fillRect(0,0,width,height);
    const haze=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,width*.6);
    haze.addColorStop(0,'#182033');haze.addColorStop(1,'#040811');ctx.fillStyle=haze;ctx.fillRect(0,0,width,height);
    if(!data)return;
    if(fallbackPortrait&&fallbackPortrait.complete&&fallbackPortrait.naturalWidth>0&&portraitOpacity>.01){
      const h=Math.min(height*.75,width*1.5),w=h/1.5;
      ctx.globalAlpha=portraitOpacity;ctx.drawImage(fallbackPortrait,width/2-w/2,height*.52-h/2,w,h);ctx.globalAlpha=1;
    }
    const scale=Math.min(width/5.4,height/5.3)/zoom;
    const co=Math.cos(yaw),si=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const project=(x,y,z)=>{const xx=x*co+z*si,zz=z*co-x*si;return {x:width/2+xx*scale,y:height*.49-(y*cp-zz*sp)*scale};};
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<data.count;i+=2){
      const k=i*3;
      const target=data.wishTargets||data.targets;
      const tx=mix(data.targets[k],target[k],messageBlend),ty=mix(data.targets[k+1],target[k+1],messageBlend);
      const x=mix(data.positions[k],tx*co,morph)+data.burst[k]*scatter;
      const y=mix(data.positions[k+1],ty,morph)+data.burst[k+1]*scatter;
      const z=mix(data.positions[k+2],tx*si,morph)+data.burst[k+2]*scatter;
      const p=project(x,y,z);const c=data.colors;
      ctx.fillStyle=`rgba(${c[k]*255|0},${c[k+1]*255|0},${c[k+2]*255|0},${.48*(1-portraitOpacity*(1-morph)*.6)})`;
      ctx.fillRect(p.x,p.y,1.2,1.2);
      const r=project(x,-2.78-y,z);ctx.globalAlpha=.12;ctx.fillRect(r.x,r.y,1.1,1.1);ctx.globalAlpha=1;
    }
    for(let i=transient.length-1;i>=0;i--){const p=transient[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=dt*.4;
      const v=project(p.x,p.y,p.z);ctx.fillStyle=`rgba(255,214,171,${Math.max(0,p.life/1.6)})`;ctx.fillRect(v.x,v.y,2,2);if(p.life<=0)transient.splice(i,1);}
    ctx.globalCompositeOperation='source-over';
    drawFallbackEncounters(ctx,dt,project);
  }

  function frame(now) {
    frameId=0;if(hidden)return;
    const delta=previous?Math.min((now-previous)/1000,.05):.016;previous=now;
    const dt=paused?0:delta;
    clock+=dt;updateState(dt);
    const easing=1-Math.exp(-delta*5);
    yaw=mix(yaw,targetYaw,easing);pitch=mix(pitch,targetPitch,easing);zoom=mix(zoom,targetZoom,easing);
    if(isFallback)drawFallback(dt);
    else {
      const a=yaw+(reduced?0:Math.sin(clock*.1)*.055)+pointerX*(reduced?0:.025);
      const elevation=pitch-pointerY*(reduced?0:.012);
      const base=width/height<.85?12.3:9.4;
      const framing=Math.max(morph,mobile?portraitOpacity:0);
      const sceneZoom=mix(zoom,Math.max(zoom,1),framing);
      const distance=base*sceneZoom*(1-charge*.055)*(1+scatter*.07);
      camera.position.set(Math.sin(a)*Math.cos(elevation)*distance,Math.sin(elevation)*distance+.55,Math.cos(a)*Math.cos(elevation)*distance);
      camera.lookAt(0,.45,0);
      [material,reflectionMaterial].forEach(mat=>{const u=mat.uniforms;u.uFacing.value=a;u.uMessageBlend.value=messageBlend;u.uPortrait.value=portraitOpacity*(1-morph)*(mobile?1:.4);u.uTime.value=clock;u.uCharge.value=charge;u.uScatter.value=scatter;u.uMorph.value=morph;u.uIntro.value=intro;u.uMotion.value=reduced?0:1;});
      lightGroup.visible=morph<.35&&scatter<.2;
      lightGroup.children.forEach((s,i)=>{s.material.opacity=(.45+(reduced?0:.12*Math.sin(clock*5+i)))*(1-scatter*5)*(1-morph);});
      if(atmosphere)atmosphere.update(clock,dt,{energy:charge,burst:scatter,pointer:{x:pointerX,y:pointerY},mode,reducedMotion:reduced});
      if(dedication)dedication.update(clock,dt,{camera,intro,mode,act,portrait:portraitOpacity,reducedMotion:reduced});
      if(encounters)encounters.update(clock,dt,{camera,energy:charge,burst:scatter,mode,reducedMotion:reduced});
      if(portrait)portrait.update(clock,dt,{camera,opacity:portraitOpacity,reducedMotion:reduced});
      updateEffects(dt);
      if(composer)composer.render();else renderer.render(world,camera);
    }
    updateGestureRibbon();
    if(!paused)schedule();
  }
  function schedule(){if(!frameId&&!hidden)frameId=requestAnimationFrame(frame);}

  function captureSpace(){
    if(performance.now()<nextPhotoAt)return;
    nextPhotoAt=performance.now()+1400;
    const source=isFallback?fallback:canvas;
    try{
      if(!isFallback){if(composer)composer.render();else renderer.render(world,camera);}
      const url=source.toDataURL('image/png');
      const link=document.createElement('a');link.download='祝小林子17岁生日快乐.png';link.href=url;link.click();
      if(!reduced){body.classList.add('is-capturing');setTimeout(()=>body.classList.remove('is-capturing'),200);}
      announce('小林子的生日留影已生成，请在浏览器下载中查看。');
    }catch(error){announce('浏览器暂不支持保存留影，可以使用设备截图。');}
  }

  [canvas,fallback].forEach(surface=>{
    surface.addEventListener('pointerdown',pointerDown);
    surface.addEventListener('pointermove',pointerMove);
    surface.addEventListener('pointerup',e=>pointerUp(e));
    surface.addEventListener('pointercancel',e=>pointerUp(e,true));
    surface.addEventListener('pointerleave',()=>cursor.classList.remove('is-visible'));
    surface.addEventListener('contextmenu',e=>e.preventDefault());
    surface.addEventListener('wheel',e=>{e.preventDefault();if(paused)return;targetZoom=clamp(targetZoom+e.deltaY*.0006,.72,1.35);hideHint();schedule();},{passive:false});
  });
  document.addEventListener('keydown',event=>{
    if(event.target.closest('button'))return;
    if(paused&&!['KeyP','KeyM','KeyS'].includes(event.code))return;
    if(['Space','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code))event.preventDefault();
    if(event.repeat)return;
    if(event.code==='Space'||event.code==='Enter'){if(mode==='idle'){keyboardHold=true;setMode('charging');hideHint();}else if(mode==='constellation')reset();}
    else if(event.code==='ArrowLeft')targetYaw+=.18;
    else if(event.code==='ArrowRight')targetYaw-=.18;
    else if(event.code==='ArrowUp')targetPitch=clamp(targetPitch+.08,-.04,.62);
    else if(event.code==='ArrowDown')targetPitch=clamp(targetPitch-.08,-.04,.62);
    else if(event.code==='KeyR')reset();
    else if(event.code==='KeyM')toggleSound();
    else if(event.code==='KeyP')togglePause();
    else if(event.code==='KeyO')showPortrait();
    else if(event.code==='KeyF')shower();
    else if(event.code==='KeyS')captureSpace();
    else if(/^Digit[1-5]$/.test(event.code)){
      const index=Number(event.code.slice(-1))-1;
      if(isFallback)activateFallbackStar(index);
      else if(encounters&&encounters.activate)encounters.activate(index,clock);
    }
    schedule();
  });
  document.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)&&keyboardHold){keyboardHold=false;celebrate();}});
  soundButton.addEventListener('click',toggleSound);motionButton.addEventListener('click',togglePause);
  if(captureButton)captureButton.addEventListener('click',captureSpace);
  window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    hidden=document.hidden;previous=0;keyboardHold=false;activeGesture=null;pointers.clear();
    if(hidden){if(frameId)cancelAnimationFrame(frameId);frameId=0;}else schedule();
    if(audioGain)audioGain.gain.setTargetAtTime(!hidden&&!paused&&audioOn?.24:0,audio.currentTime,.15);
  });
  preference.addEventListener('change',()=>{reduced=preference.matches;announce(reduced?'已减少空间动态效果。':'已恢复空间动态效果。');schedule();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(!isFallback)startFallback('WebGL context lost');});
  window.addEventListener('pagehide',()=>{if(frameId)cancelAnimationFrame(frameId);frameId=0;hidden=true;if(audio)audio.suspend();});
  window.addEventListener('pageshow',()=>{hidden=document.hidden;previous=0;schedule();restoreAudio();});
  try{initializeScene();}catch(error){startFallback(error);}
  body.classList.add('is-ready');
  setTimeout(hideHint,7000);
  schedule();
})();
