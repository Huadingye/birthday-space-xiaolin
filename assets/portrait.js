/* OC particles gather from the surrounding space before the dimmed portrait resolves. */
(function(){
  'use strict';
  window.createBirthdayPortrait=function(THREE,scene,options){
    const mobile=!!options.mobile,root=new THREE.Group();
    root.name='oc-apparition';scene.add(root);
    const width=mobile?2.75:3.25,height=width*1.5;
    const imageVisibility={value:0},imageReveal={value:0},imageTime={value:0};
    const particleVisibility={value:0},particleProgress={value:0},particleTime={value:0},pixelRatio={value:1};
    let loaded=false,failed=false,texture=null,particleGeometry=null,particleMaterial=null,particles=null;
    let progress=0,previousAlpha=0,direction=0,disposed=false,seed=290317;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
    function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}

    const imageMaterial=new THREE.ShaderMaterial({
      uniforms:{uMap:{value:null},uVisibility:imageVisibility,uReveal:imageReveal,uTime:imageTime},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`precision highp float;
        uniform sampler2D uMap;uniform float uVisibility,uReveal,uTime;varying vec2 vUv;
        void main(){vec4 image=texture2D(uMap,vUv);
          vec3 backdrop=vec3(3.,6.,16.)/255.;
          float separation=length(image.rgb-backdrop);
          float matte=smoothstep(.025,.09,separation);
          float edge=smoothstep(0.,.065,vUv.x)*smoothstep(0.,.065,1.-vUv.x)*smoothstep(0.,.045,vUv.y)*smoothstep(0.,.045,1.-vUv.y);
          float scanOffset=(vUv.y-fract(uTime*.075))*28.;
          float scan=exp(-scanOffset*scanOffset);
          vec3 color=image.rgb*.76+vec3(.014,.023,.04)*scan;
          gl_FragColor=vec4(color,image.a*matte*edge*uVisibility*uReveal);
        }`,
      transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),imageMaterial);
    mesh.renderOrder=5;root.add(mesh);

    const particleUniforms={uProgress:particleProgress,uOpacity:particleVisibility,uTime:particleTime,uRatio:pixelRatio};
    function createParticles(image){
      const imageWidth=image.naturalWidth||image.width,imageHeight=image.naturalHeight||image.height;
      if(!imageWidth||!imageHeight)return false;
      const canvas=document.createElement('canvas');canvas.width=imageWidth;canvas.height=imageHeight;
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return false;
      try{context.drawImage(image,0,0);}
      catch(_){return false;}
      let pixels;
      try{pixels=context.getImageData(0,0,imageWidth,imageHeight).data;}
      catch(_){return false;}
      const step=mobile?7:6,candidates=[];
      for(let y=step>>1;y<imageHeight;y+=step)for(let x=step>>1;x<imageWidth;x+=step){
        const k=(y*imageWidth+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2],a=pixels[k+3];
        const dr=r-3,dg=g-6,db=b-16;
        if(a<120||dr*dr+dg*dg+db*db<420)continue;
        candidates.push(x,y,r,g,b);
      }
      const maxPoints=mobile?5000:7600,count=Math.min(maxPoints,candidates.length/5|0);
      if(count<100)return false;
      const starts=new Float32Array(count*3),targets=new Float32Array(count*3),colors=new Float32Array(count*3),seeds=new Float32Array(count),sizes=new Float32Array(count);
      for(let i=0;i<count;i++){
        const source=Math.min(candidates.length-5,Math.floor((i+.5)*(candidates.length/5)/count)*5);
        const x=candidates[source],y=candidates[source+1],k=i*3;
        const targetX=(x/imageWidth-.5)*width,targetY=(.5-y/imageHeight)*height,targetZ=(random()-.5)*.08;
        const angle=random()*Math.PI*2,vertical=random()*2-1,ring=Math.sqrt(1-vertical*vertical),distance=2.1+random()*3.4;
        targets[k]=targetX;targets[k+1]=targetY;targets[k+2]=targetZ;
        starts[k]=targetX+Math.cos(angle)*ring*distance;
        starts[k+1]=targetY+vertical*distance;
        starts[k+2]=targetZ+Math.sin(angle)*ring*distance;
        colors[k]=.07+candidates[source+2]*.0018;
        colors[k+1]=.07+candidates[source+3]*.0018;
        colors[k+2]=.09+candidates[source+4]*.0018;
        seeds[i]=random();sizes[i]=.8+random()*1.5;
      }
      particleGeometry=new THREE.BufferGeometry();
      particleGeometry.setAttribute('position',new THREE.BufferAttribute(starts,3));
      particleGeometry.setAttribute('aTarget',new THREE.BufferAttribute(targets,3));
      particleGeometry.setAttribute('aColor',new THREE.BufferAttribute(colors,3));
      particleGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
      particleGeometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
      particleMaterial=new THREE.ShaderMaterial({
        uniforms:particleUniforms,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
        vertexShader:`attribute vec3 aTarget,aColor;attribute float aSeed,aSize;
          uniform float uProgress,uOpacity,uTime,uRatio;varying vec3 vColor;varying float vAlpha;
          void main(){float t=smoothstep(0.,1.,uProgress);vec3 p=mix(position,aTarget,t);
            float drift=1.-t;float orbit=aSeed*6.2831853+uTime*(.8+aSeed*.6);
            p.x+=cos(orbit)*(.11+aSeed*.16)*drift;p.y+=sin(orbit*1.31)*(.12+aSeed*.14)*drift;p.z+=cos(orbit*.73)*.11*drift;
            vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
            gl_PointSize=clamp((.9+aSize)*uRatio*32./max(2.,-mv.z),.75,5.5*uRatio);
            vColor=aColor;vAlpha=uOpacity*(.34+aSeed*.42)*(1.-smoothstep(.72,1.,uProgress));}`,
        fragmentShader:`precision highp float;varying vec3 vColor;varying float vAlpha;
          void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
            float glow=exp(-d*d*4.5)*(1.-smoothstep(.62,1.,d));gl_FragColor=vec4(vColor,glow*vAlpha);}`
      });
      particles=new THREE.Points(particleGeometry,particleMaterial);particles.frustumCulled=false;particles.renderOrder=6;root.add(particles);
      return true;
    }

    if(window.OC_PORTRAIT_DATA_URL){
      new THREE.TextureLoader().load(window.OC_PORTRAIT_DATA_URL,t=>{
        texture=t;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;
        imageMaterial.uniforms.uMap.value=t;createParticles(t.image);loaded=true;
        if(previousAlpha>.002){progress=0;direction=1;}
      },undefined,()=>{failed=true;});
    } else failed=true;
    root.visible=false;
    return {
      update(t,dt,state){
        if(disposed)return;
        state=state||{};const alpha=clamp(state.opacity||0,0,1),delta=clamp(dt||0,0,.06);
        if(alpha>previousAlpha+.001){if(previousAlpha<=.002)progress=0;direction=1;}
        else if(alpha<previousAlpha-.001)direction=-1;
        if(direction>0)progress=Math.min(1,progress+delta/(state.reducedMotion?.7:1.55));
        else if(direction<0)progress=Math.max(0,progress-delta/(state.reducedMotion?.4:1.0));
        previousAlpha=alpha;
        root.visible=loaded&&(alpha>.002||progress>.002);
        imageVisibility.value=alpha*.68;imageReveal.value=smoothstep(.72,.98,progress);imageTime.value=t;
        particleVisibility.value=alpha*.82;particleProgress.value=progress;particleTime.value=t;
        const cam=state.camera;
        if(cam){
          const right=new THREE.Vector3(1,0,0).applyQuaternion(cam.quaternion);
          root.position.set(0,mobile?-.2:.35,-.3).addScaledVector(right,mobile?0:2.8);
          root.quaternion.copy(cam.quaternion);
        }
        if(!state.reducedMotion)root.position.y+=Math.sin(t*.6)*.04;
      },
      resize(ratio){pixelRatio.value=Math.min(ratio||1,mobile?1.45:1.8);},
      get ready(){return loaded;},get failed(){return failed;},
      dispose(){if(disposed)return;disposed=true;scene.remove(root);mesh.geometry.dispose();imageMaterial.dispose();if(particleGeometry)particleGeometry.dispose();if(particleMaterial)particleMaterial.dispose();if(texture)texture.dispose();root.clear();}
    };
  };
})();
