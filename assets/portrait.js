/* A portrait apparition integrated into the 3D scene; embedded local bitmap. */
(function(){
  'use strict';
  window.createBirthdayPortrait=function(THREE,scene,options){
    const mobile=!!options.mobile,root=new THREE.Group();
    root.name='oc-apparition';scene.add(root);
    const opacity={value:0},time={value:0};
    let loaded=false,failed=false,texture=null;
    const width=mobile?2.75:3.25,height=width*1.5;
    const material=new THREE.ShaderMaterial({
      uniforms:{uMap:{value:null},uOpacity:opacity,uTime:time},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`precision highp float;
        uniform sampler2D uMap;uniform float uOpacity,uTime;varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec4 image=texture2D(uMap,vUv);
          float edge=smoothstep(0.,.13,vUv.x)*smoothstep(0.,.13,1.-vUv.x)*smoothstep(0.,.09,vUv.y)*smoothstep(0.,.09,1.-vUv.y);
          float light=max(max(image.r,image.g),image.b);
          float matte=smoothstep(.025,.15,light);
          float noise=hash(floor(vUv*vec2(100.,150.)));
          float reveal=smoothstep(noise*.75,noise*.75+.25,uOpacity);
          float scanOffset=(vUv.y-fract(uTime*.09))*24.;
          float scan=exp(-scanOffset*scanOffset);
          vec3 color=image.rgb+vec3(.05,.1,.18)*scan;
          gl_FragColor=vec4(color,image.a*edge*matte*reveal*uOpacity);
        }`,
      transparent:true,depthWrite:false,side:THREE.DoubleSide
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
    mesh.renderOrder=5;root.add(mesh);
    const rimPoints=[];
    for(let i=0;i<=180;i++){
      const a=i/180*Math.PI*2;
      rimPoints.push(new THREE.Vector3(Math.cos(a)*width*.52,Math.sin(a)*height*.49,-.04));
    }
    const rimMat=new THREE.LineBasicMaterial({color:0xa2c5ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    const rim=new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPoints),rimMat);root.add(rim);
    if(window.OC_PORTRAIT_DATA_URL){
      new THREE.TextureLoader().load(window.OC_PORTRAIT_DATA_URL,t=>{
        texture=t;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;material.uniforms.uMap.value=t;loaded=true;
      },undefined,()=>{failed=true;});
    } else failed=true;
    root.visible=false;
    return {
      update(t,dt,state){
        const alpha=state.opacity||0;root.visible=alpha>.002&&loaded;
        opacity.value=alpha;time.value=t;
        // Position beside the cake on desktop, centered for a mobile apparition.
        const cam=state.camera;
        if(cam){
          const right=new THREE.Vector3(1,0,0).applyQuaternion(cam.quaternion);
          root.position.set(0,mobile?-.2:.35,-.3).addScaledVector(right,mobile?0:2.8);
          root.quaternion.copy(cam.quaternion);
        }
        if(!state.reducedMotion)root.position.y+=Math.sin(t*.6)*.055;
        rimMat.opacity=alpha*.3;
      },
      get ready(){return loaded;},get failed(){return failed;},
      dispose(){scene.remove(root);mesh.geometry.dispose();rim.geometry.dispose();material.dispose();rimMat.dispose();if(texture)texture.dispose();}
    };
  };
})();
