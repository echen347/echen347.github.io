/*
MIT License

Copyright (c) 2017 Pavel Dobryakov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Compact WebGL2 adaptation of Pavel Dobryakov's fluid simulation.
(function () {
  'use strict';

  const VERTEX = `#version 300 es
    precision highp float;
    out vec2 uv;
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      uv = p;
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;
  const HEADER = `#version 300 es
    precision highp float;
    precision highp sampler2D;
    in vec2 uv;
    out vec4 outColor;
  `;
  const SHADERS = {
    seed: `uniform sampler2D source;
      uniform sampler2D deformation;
      uniform float warp;
      uniform float aspect;
      uniform float phase;
      uniform float streamTime;
      uniform float amount;
      uniform int field;
      uniform int glass;
      uniform vec3 waveA;
      uniform vec3 waveB;
      uniform vec3 tintA;
      uniform vec3 tintB;
      uniform vec3 tintMist;
      uniform float moodOn;
      uniform vec3 coreShift;
      uniform vec3 moodA;
      uniform vec3 moodB;
      uniform vec3 moodMist;
      uniform vec3 moodCore;
      uniform vec3 moodEdge;
      uniform float moodFront;
      uniform float moodWidth;
      uniform vec2 moodDir;
      uniform float flowSpeed;
      uniform vec2 flowScale;
      // Cubic reconstruction keeps the strand tangent smooth across solver cells.
      vec2 opticalShift(vec2 point) {
        vec2 texel=1.0/vec2(textureSize(deformation,0));
        vec2 cell=point/texel-.5, base=floor(cell), f=fract(cell);
        vec2 f2=f*f, f3=f2*f;
        vec2 w0=(1.0-3.0*f+3.0*f2-f3)/6.0;
        vec2 w1=(4.0-6.0*f2+3.0*f3)/6.0;
        vec2 w2=(1.0+3.0*f+3.0*f2-3.0*f3)/6.0;
        vec2 w3=f3/6.0;
        vec2 g0=w0+w1, g1=w2+w3;
        vec2 p0=(base-.5+w1/g0)*texel;
        vec2 p1=(base+1.5+w3/g1)*texel;
        return mix(mix(texture(deformation,p0).xy,texture(deformation,vec2(p1.x,p0.y)).xy,g1.x),
          mix(texture(deformation,vec2(p0.x,p1.y)).xy,texture(deformation,p1).xy,g1.x),g1.y);
      }
      float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      float filteredNoise(vec2 coordinate) {
        float footprint=max(length(dFdx(coordinate)),length(dFdy(coordinate)));
        return mix(noise(coordinate),.5,smoothstep(.30,.80,footprint));
      }
      float sinc(float x) {
        return abs(x)<.001 ? 1.0-x*x/6.0 : sin(x)/x;
      }
      float filteredPulse(float phase,vec2 footprint,int power) {
        // Integrate raised-cosine harmonics across the pixel's rectangular footprint.
        float coefficient=power==10 ? .176197052001953 : .10257817300857;
        float value=coefficient;
        float previous=1.0, current=cos(phase), cosine=current;
        for(int k=1;k<=20;k++) {
          if(k>power) break;
          coefficient*=float(power-k+1)/float(power+k);
          float frequency=float(k);
          // Box integration alone still aliases harmonics above the grid limit.
          float pixelFrequency=max(abs(footprint.x),abs(footprint.y))*frequency;
          if(pixelFrequency>=3.141592654) break;
          float bandlimit=1.0-smoothstep(2.042035225,3.141592654,pixelFrequency);
          value+=2.0*coefficient*current*sinc(footprint.x*frequency*.5)*sinc(footprint.y*frequency*.5)*bandlimit;
          float next=2.0*cosine*current-previous;
          previous=current;current=next;
        }
        return clamp(value,0.0,1.0);
      }
      void main() {
        vec2 p=(uv-.5)*vec2(aspect,1.0);
        p/=min(aspect,1.0);
        float angle=waveA.x+.10*sin(phase);
        p=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*p;
        if(field==1) {
          if(flowSpeed>0.0) {
            // Parallel bands share a centerline. Its analytic tangent seeds an
            // interior divergence-free drift, without touching later brush force.
            float frequency=waveA.z;
            float slope=waveA.y*frequency*(
              .52*cos(p.x*4.0*frequency+.85+phase*.3)+
              .525*cos(p.x*7.0*frequency-1.0)-
              .175*cos(p.x*5.0*frequency+phase+1.0));
            vec2 along=vec2(1.0,slope)*flowSpeed;
            // Invert the optical rotation, then convert material units to the
            // solver's texel velocities, including portrait aspect scaling.
            vec2 world=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*along;
            outColor=vec4(world*flowScale,0,1); return;
          }
          vec2 v=vec2(0);
          for(int i=0;i<3;i++) {
            float j=float(i);
            vec2 d=p-vec2(-.36+.35*j,.08*cos(j*2.7+phase));
            float turn=i==1?-1.0:1.0;
            v+=turn*vec2(-d.y,d.x)*4.0/(dot(d,d)+.026);
          }
          outColor=vec4(v,0,1); return;
        }
        if(warp>0.0) {
          // Evaluate the initial pattern at its transported material coordinates.
          vec2 shift=warp*opticalShift(uv);
          p+=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*shift;
        }
        vec3 light=vec3(0);
        // The front uses transported coordinates, so it bends around vortices.
        float frontCoord=dot(p,moodDir);
        // Every mood uniform is neutral at zero, so code that compiles this shader
        // without the concert (tests, tools) renders the stock light.
        float mood=moodOn*(1.0-smoothstep(moodFront-moodWidth,moodFront+moodWidth,frontCoord));
        float frontDistance=(frontCoord-moodFront)/max(moodWidth,1e-3);
        float edgeGlow=moodOn*exp(-frontDistance*frontDistance);
        for(int i=0;i<3;i++) {
          float j=float(i);
          float curveIndex=flowSpeed>0.0?1.0:j;
          vec2 q=p;
          q.y+=.035*waveA.y*sin(q.x*5.0*waveA.z+phase+curveIndex);
          float bend=waveA.y*(.13*sin(q.x*4.0*waveA.z+curveIndex*.85+phase*.3)+.075*sin(q.x*7.0*waveA.z-curveIndex));
          float cross=q.y-bend+(j-1.0)*waveB.x;
          float width=(.07+.025*cos(q.x*6.0+j*2.0))*waveB.z;
          float sheet=exp(-pow(abs(cross)/width,4.0));
          sheet*=exp(-pow(abs(q.x)/(.63+.04*j),6.0));
          float turbulence=noise(q*9.0+phase)*.6+noise(q*23.0+curveIndex)*.15;
          float strand=(flowSpeed>0.0?q.y-bend:cross)*waveB.y+sin(q.x*8.0+curveIndex)*5.0+turbulence*9.0;
          vec2 footprint=vec2(dFdx(strand),dFdy(strand));
          float line=filteredPulse(strand,footprint,10);
          float core=filteredPulse(strand,footprint,30);
          // Texture travels along each material strand, like orbiting disk light.
          // The strand geometry and fluid history do not depend on this clock.
          float lane=strand/6.2831853;
          float along=q.x-streamTime*.14*(.85+.15*cos(lane*.06));
          float streaming=.68*filteredNoise(vec2(along*6.0+phase*.16,lane*.08))+
            .32*filteredNoise(vec2(along*15.0+8.3,lane*.045+3.7));
          // Continuous amplitude avoids brightness jumps between adjacent strands.
          float pulse=flowSpeed>0.0 ? .32+.24*streaming :
            .18+.82*pow(noise(vec2(q.x*4.0+phase*.4,strand/6.2831853*.71+j*5.0)),2.0);
          vec3 tint=mix(tintA,tintB,smoothstep(-.35,.40,q.x+.22*sin(phase)));
          tint=mix(tint,tintMist,.16+.14*sin(j*2.4));
          vec3 moodTint=mix(moodA,moodB,smoothstep(-.35,.40,q.x+.22*sin(phase)));
          moodTint=mix(moodTint,moodMist,.16+.14*sin(j*2.4));
          tint=mix(tint,moodTint,mood);
          light+=sheet*pulse*(tint*(.018+line*4.0)+vec3(.92,.91,.85)*core*1.5);
          // Concert: move the strand core from stock (plus a committed shift) toward the mood core.
          light+=sheet*pulse*mix(coreShift,moodCore-vec3(.92,.91,.85),mood)*core*1.5;
          light+=sheet*edgeGlow*moodEdge*(.25+line*2.5);
        }
        vec3 wake=max(texture(source,uv).rgb,vec3(0));
        if(glass==1) {
          // Dye already fades in transport. Keep its emission gain as it thins.
          float density=dot(wake,vec3(.25,.55,.20));
          float emission=4.0+3.0*smoothstep(.09,.28,density);
          wake*=emission;
        }
        outColor=vec4(wake+light*amount,1);
        // Composition alpha is never read by the stock passes; the display uses it as the mood mask.
        if(moodOn>0.0) outColor.a=mood;
      }`,
    splat: `uniform sampler2D source;
      uniform vec2 point;
      uniform vec2 start;
      uniform vec3 color;
      uniform vec3 startColor;
      uniform float radius;
      uniform float aspect;
      float erfApprox(float x) {
        float t=1.0/(1.0+0.3275911*abs(x));
        float polynomial=((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t;
        return sign(x)*(1.0-polynomial*exp(-x*x));
      }
      void main() {
        vec2 p = uv * vec2(aspect,1.0);
        vec2 a = start * vec2(aspect,1.0);
        vec2 segment = point * vec2(aspect,1.0) - a;
        vec2 d=p-a;
        float segmentLength=length(segment);
        float weight, colorAlong=0.0;
        if(segmentLength>1e-5) {
          vec2 tangent=segment/segmentLength;
          float along=dot(d,tangent);
          vec2 perpendicular=d-tangent*along;
          float spread=sqrt(radius);
          if(length(perpendicular)>4.5*spread || along < -4.5*spread || along > segmentLength+4.5*spread) {
            outColor=texture(source,uv); return;
          }
          weight=exp(-dot(perpendicular,perpendicular)/radius)*0.5*
            (erfApprox(along/spread)-erfApprox((along-segmentLength)/spread));
          colorAlong=clamp(along/segmentLength,0.0,1.0);
        } else {
          weight=exp(-dot(d,d)/radius);
        }
        vec3 ink=mix(startColor,color,colorAlong);
        outColor = texture(source, uv) + vec4(ink*max(weight,0.0),0.0);
      }`,
    vortex: `uniform sampler2D source;
      uniform vec2 center;
      uniform vec2 velocityScale;
      uniform float aspect;
      uniform float radius;
      uniform float spin;
      uniform float velocityPass;
      uniform vec3 color;
      void main() {
        vec2 d=(uv-center)*vec2(aspect,1.0)/radius;
        float r2=dot(d,d);
        vec4 previous=texture(source,uv);
        if(velocityPass>0.5) {
          // A radial falloff times the perpendicular radius is divergence-free.
          // Convert physical screen velocity to the solver's texel units.
          vec2 swirl=vec2(-d.y,d.x)*exp(-r2)*spin*velocityScale;
          outColor=previous+vec4(swirl,0,0);
        } else {
          // A soft crescent makes a click visible even away from the white sheet.
          // It enters dye history once, then the solver rolls it into the vortex.
          float edge=(sqrt(r2)-.52)/.24;
          float crescent=exp(-edge*edge);
          crescent*=.16+.84*smoothstep(-.6,.8,d.x);
          outColor=previous+vec4(color*crescent,0);
        }
      }`,
    deformation: `uniform sampler2D source;
      uniform sampler2D velocity;
      uniform vec2 texel;
      uniform float dt;
      uniform float aspect;
      void main() {
        vec2 flow=texture(velocity,uv).xy*texel;
        vec2 back=clamp(uv-dt*flow,texel*.5,vec2(1)-texel*.5);
        vec2 history=texture(source,back).xy;
        vec2 materialStep=(back-uv)*vec2(aspect,1.0)/min(aspect,1.0);
        // x + displacement follows the initial material, with no restoring force.
        // Clamping the backtrace bounds material coordinates at the domain edge.
        vec2 shift=history+materialStep;
        outColor=vec4(shift,0,1);
      }`,
    advection: `uniform sampler2D velocity;
      uniform sampler2D source;
      uniform vec2 texel;
      uniform float dt;
      uniform float dissipation;
      vec2 dyeVelocity(vec2 point) {
        // Positive cubic B-spline weights smooth coarse-grid slope changes without
        // overshooting velocity. Paired weights reduce sixteen taps to four.
        vec2 cell=point/texel-.5, base=floor(cell), f=fract(cell);
        vec2 f2=f*f, f3=f2*f;
        vec2 w0=(1.0-3.0*f+3.0*f2-f3)/6.0;
        vec2 w1=(4.0-6.0*f2+3.0*f3)/6.0;
        vec2 w2=(1.0+3.0*f+3.0*f2-3.0*f3)/6.0;
        vec2 w3=f3/6.0;
        vec2 g0=w0+w1, g1=w2+w3;
        vec2 p0=(base-.5+w1/g0)*texel;
        vec2 p1=(base+1.5+w3/g1)*texel;
        return mix(mix(texture(velocity,p0).xy,texture(velocity,vec2(p1.x,p0.y)).xy,g1.x),
          mix(texture(velocity,vec2(p0.x,p1.y)).xy,texture(velocity,p1).xy,g1.x),g1.y);
      }
      void main() {
        vec2 size=vec2(textureSize(source,0));
        bool fineDye=any(greaterThan(size,vec2(textureSize(velocity,0))));
        vec2 flow=fineDye?dyeVelocity(uv):texture(velocity,uv).xy;
        vec2 coord = uv - dt * flow * texel;
        vec2 dx=dFdx(coord),dy=dFdy(coord);
        float footprint=max(length(dx*size),length(dy*size));
        vec4 color=texture(source,coord);
        // Average the mapped pixel area only where flow compresses the texture.
        if(footprint>1.01) {
          vec4 filtered=vec4(0);
          for(int y=0;y<4;y++) for(int x=0;x<4;x++) {
            vec2 offset=(vec2(float(x),float(y))+.5)/4.0-.5;
            filtered+=texture(source,coord+dx*offset.x+dy*offset.y);
          }
          color=mix(color,filtered/16.0,smoothstep(1.0,1.5,footprint));
        }
        outColor = color / (1.0 + dissipation * dt);
      }`,
    curl: `uniform sampler2D velocity;
      uniform vec2 texel;
      void main() {
        float l = texture(velocity, uv-vec2(texel.x,0)).y;
        float r = texture(velocity, uv+vec2(texel.x,0)).y;
        float b = texture(velocity, uv-vec2(0,texel.y)).x;
        float t = texture(velocity, uv+vec2(0,texel.y)).x;
        outColor = vec4(0.5*(r-l-t+b),0,0,1);
      }`,
    vorticity: `uniform sampler2D velocity;
      uniform sampler2D curl;
      uniform vec2 texel;
      uniform float dt;
      uniform float strength;
      void main() {
        float l = abs(texture(curl,uv-vec2(texel.x,0)).x);
        float r = abs(texture(curl,uv+vec2(texel.x,0)).x);
        float b = abs(texture(curl,uv-vec2(0,texel.y)).x);
        float t = abs(texture(curl,uv+vec2(0,texel.y)).x);
        float c = texture(curl,uv).x;
        vec2 force = vec2(t-b,r-l);
        force /= length(force)+0.0001;
        force *= strength*c*dt;
        force.y *= -1.0;
        outColor = vec4(clamp(texture(velocity,uv).xy+force,vec2(-900),vec2(900)),0,1);
      }`,
    divergence: `uniform sampler2D velocity;
      uniform vec2 texel;
      void main() {
        vec2 c = texture(velocity,uv).xy;
        float l = uv.x-texel.x < 0.0 ? -c.x : texture(velocity,uv-vec2(texel.x,0)).x;
        float r = uv.x+texel.x > 1.0 ? -c.x : texture(velocity,uv+vec2(texel.x,0)).x;
        float b = uv.y-texel.y < 0.0 ? -c.y : texture(velocity,uv-vec2(0,texel.y)).y;
        float t = uv.y+texel.y > 1.0 ? -c.y : texture(velocity,uv+vec2(0,texel.y)).y;
        outColor = vec4(0.5*(r-l+t-b),0,0,1);
      }`,
    pressure: `uniform sampler2D pressure;
      uniform sampler2D divergence;
      uniform vec2 texel;
      void main() {
        float l = texture(pressure,uv-vec2(texel.x,0)).x;
        float r = texture(pressure,uv+vec2(texel.x,0)).x;
        float b = texture(pressure,uv-vec2(0,texel.y)).x;
        float t = texture(pressure,uv+vec2(0,texel.y)).x;
        float d = texture(divergence,uv).x;
        outColor = vec4((l+r+b+t-d)*0.25,0,0,1);
      }`,
    gradient: `uniform sampler2D pressure;
      uniform sampler2D velocity;
      uniform vec2 texel;
      void main() {
        float l = texture(pressure,uv-vec2(texel.x,0)).x;
        float r = texture(pressure,uv+vec2(texel.x,0)).x;
        float b = texture(pressure,uv-vec2(0,texel.y)).x;
        float t = texture(pressure,uv+vec2(0,texel.y)).x;
        outColor = vec4(texture(velocity,uv).xy - vec2(r-l,t-b),0,1);
      }`,
    bloom: `uniform sampler2D dye;
      uniform vec2 texel;
      uniform int glass;
      void main() {
        vec3 c = texture(dye,uv).rgb;
        c += texture(dye,uv+vec2(texel.x,0)).rgb;
        c += texture(dye,uv-vec2(texel.x,0)).rgb;
        c += texture(dye,uv+vec2(0,texel.y)).rgb;
        c += texture(dye,uv-vec2(0,texel.y)).rgb;
        c *= 0.2;
        vec3 glow=max(c-vec3(0.30),0.0);
        if(glass==1) {
          // Keep a colored halo below the bright-pass cutoff. The quadratic
          // near-black tail clears fully instead of leaving a uniform haze.
          float energy=dot(c,vec3(.25,.55,.20));
          glow+=c*(.45*energy/(energy+.02)*.30/(energy+.30));
        }
        outColor=vec4(glow,1);
      }`,
    blur: `uniform sampler2D source;
      uniform vec2 offset;
      void main() {
        vec3 c = texture(source,uv).rgb * 0.227027;
        c += texture(source,uv+offset*1.384615).rgb * 0.316216;
        c += texture(source,uv-offset*1.384615).rgb * 0.316216;
        c += texture(source,uv+offset*3.230769).rgb * 0.070270;
        c += texture(source,uv-offset*3.230769).rgb * 0.070270;
        outColor = vec4(c,1);
      }`,
    downsample: `uniform sampler2D source;
      uniform vec2 sourceFootprint;
      void main() {
        vec3 color=vec3(0);
        // Cover the entire destination pixel before the fourfold reduction.
        for(int y=0;y<4;y++) for(int x=0;x<4;x++) {
          vec2 offset=((vec2(float(x),float(y))+.5)/4.0-.5)*sourceFootprint;
          color+=texture(source,uv+offset).rgb;
        }
        outColor=vec4(color/16.0,1);
      }`,
    wideBlur: `uniform sampler2D source;
      uniform vec2 offset;
      void main() {
        // Contiguous Gaussian taps, sigma 3.274 texels, normalized to unit energy.
        // Stretching the compact five-tap kernel leaves separated light patches.
        const float weights[11]=float[11](.1220163332,.1164547589,.1012453425,
          .0801809891,.0578424004,.0380101643,.0227526365,.0124062993,
          .0061621366,.0027880395,.0011490663);
        vec3 color=texture(source,uv).rgb*weights[0];
        for(int i=1;i<=10;i++) {
          vec2 stepOffset=offset*float(i);
          color+=(texture(source,uv+stepOffset).rgb+texture(source,uv-stepOffset).rgb)*weights[i];
        }
        outColor=vec4(color,1);
      }`,
    surface: `uniform sampler2D source;
      uniform vec2 footprint;
      void main() {
        float height=0.0;
        // Filter both axes before reducing resolution, then bound HDR peaks.
        for(int y=0;y<4;y++) for(int x=0;x<4;x++) {
          vec2 offset=((vec2(float(x),float(y))+.5)/4.0-.5)*footprint;
          vec3 radiance=max(texture(source,uv+offset).rgb,vec3(0));
          height+=1.0-exp(-dot(radiance,vec3(.25,.55,.20))*.65);
        }
        outColor=vec4(vec3(height/16.0),1);
      }`,
    display: `uniform sampler2D dye;
      uniform sampler2D bloom;
      uniform sampler2D wideBloom;
      uniform sampler2D surface;
      uniform vec2 texel;
      uniform vec2 surfaceTexel;
      uniform int glass;
      uniform float glowStrength;
      uniform float moodOn;
      uniform vec3 coolShift;
      uniform vec3 warmShift;
      uniform vec3 moodCool;
      uniform vec3 moodWarm;
      void main() {
        vec3 pigment = max(texture(dye,uv).rgb,vec3(0));
        vec3 color = pigment;
        if (glass == 1) {
          float thickness=max(texture(surface,uv).r,0.0);
          float l=texture(surface,uv-vec2(surfaceTexel.x,0)).r;
          float r=texture(surface,uv+vec2(surfaceTexel.x,0)).r;
          float b=texture(surface,uv-vec2(0,surfaceTexel.y)).r;
          float t=texture(surface,uv+vec2(0,surfaceTexel.y)).r;
          float shortTexel=max(max(surfaceTexel.x,surfaceTexel.y),1e-5);
          vec2 slope=vec2(r-l,t-b)/(2.0*shortTexel);
          vec3 normal=normalize(vec3(-slope*.12,1.0));
          float coverage=smoothstep(.006,.16,thickness);

          // Screen-space transmission through the broad surface, not the strands.
          vec2 shift=normal.xy*(.012+.010*thickness)*coverage*surfaceTexel/shortTexel;
          vec2 margin=texel*.5;
          vec3 transmitted=vec3(
            texture(dye,clamp(uv+shift*.975,margin,vec2(1)-margin)).r,
            texture(dye,clamp(uv+shift,margin,vec2(1)-margin)).g,
            texture(dye,clamp(uv+shift*1.025,margin,vec2(1)-margin)).b);
          vec3 absorption=exp(-thickness*vec3(.28,.10,.04));
          color=mix(pigment,transmitted*absorption,.58*coverage);
          color*=1.0-.10*coverage*thickness/(.2+thickness);

          // Two broad studio lights reflect as narrow moving glints on the folds.
          // Preserve fold angles as material thins, without amplifying refraction.
          // The bounded gain returns the reflection to flat as thickness reaches zero.
          vec3 reflectionNormal=normalize(vec3(-slope*.12*max(1.0,.18/max(thickness,.03)),1.0));
          vec3 reflected=reflect(vec3(0,0,-1),reflectionNormal);
          float reflectionFresnel=.04+.96*pow(1.0-reflectionNormal.z,5.0);
          float reflectionCoverage=1.0-exp(-pow(thickness/.045,2.0));
          float cool=exp(-pow((reflected.x+.34)/.22,2.0)-pow((reflected.y-.58)/.65,2.0));
          float warm=exp(-pow((reflected.x-.55)/.16,2.0)-pow((reflected.y+.30)/.60,2.0));
          float moodMask=moodOn*clamp(texture(dye,uv).a,0.0,1.0);
          vec3 reflection=mix(vec3(.82,.95,1.08)+coolShift,moodCool,moodMask)*3.4*cool+
            mix(vec3(1.1,.64,.36)+warmShift,moodWarm,moodMask)*2.6*warm;
          // Smoothed surface normals extend beyond the visible fluid. Limit their
          // reflections by local material support without thresholding thin edges.
          float localHeight=1.0-exp(-dot(pigment,vec3(.25,.55,.20))*.65);
          float reflectionSupport=clamp(localHeight/max(thickness,.006),0.0,1.0);
          color+=reflectionCoverage*reflectionSupport*reflectionFresnel*reflection;
        }
        color=max(color-vec3(.008),vec3(0));
        color += glowStrength*(texture(bloom,uv).rgb * .24 + texture(wideBloom,uv).rgb * .40);
        color += vec3(.0004,.0012,.0020);
        color = vec3(1.0)-exp(-color*1.15);
        color = pow(color,vec3(0.454545));
        outColor = vec4(color,1);
      }`
  };

  const tuningSchema=Object.freeze([
    {key:'trailWidth',label:'Trail width',min:.4,max:2.5,step:.05,defaultValue:1,unit:'×'},
    {key:'dyeBrightness',label:'Color density',min:0,max:3,step:.05,defaultValue:1.2,unit:'×'},
    {key:'glowStrength',label:'Glow',min:0,max:2,step:.05,defaultValue:1,unit:'×'},
    {key:'curlStrength',label:'Curl strength',min:0,max:2,step:.05,defaultValue:1,unit:'×'},
    {key:'cursorForce',label:'Cursor force',min:0,max:3,step:.05,defaultValue:1,unit:'×'},
    {key:'fadeTime',label:'Fade time',min:1,max:12,step:.25,defaultValue:4,unit:'s'}
  ].map(Object.freeze));
  const tuningDefaults=Object.fromEntries(tuningSchema.map(({key,defaultValue})=>[key,defaultValue]));
  function validateTuning(current,patch) {
    if(!patch || typeof patch!=='object' || Array.isArray(patch)) throw new TypeError('Expected tuning values');
    const next={...current};
    for(const [key,value] of Object.entries(patch)) {
      const setting=tuningSchema.find(setting=>setting.key===key);
      if(!setting || typeof value!=='number' || !Number.isFinite(value)) throw new TypeError('Invalid tuning value: '+key);
      next[key]=Math.max(setting.min,Math.min(setting.max,value));
    }
    return next;
  }

  function create(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Expected a canvas');
    let tuning=validateTuning(tuningDefaults,options.tuning===undefined?{}:options.tuning);
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
      const error = new Error('WebGL2 floating-point framebuffers are unavailable');
      canvas.dataset.state = 'error';
      options.onError?.(error);
      throw error;
    }
    let disposed = false, contextLost = false, raf = 0, hidden = document.hidden;
    let paused = options.paused === undefined ? matchMedia('(prefers-reduced-motion: reduce)').matches : !!options.paused;
    let material = 'glass';
    let seed = Number.isFinite(options.seed) ? options.seed >>> 0 : 347;
    let randomState = seed;
    let lightStyle, palette;
    let lastTime = performance.now(), interactions = 0, frames = 0;
    let velocity, dye, deformation, composition, opticalA, opticalB, pressure, divergence, curl, glowA, glowB, wideA, wideB;
    let simWidth = 0, simHeight = 0, dyeWidth = 0, dyeHeight = 0;
    const programs = {}, locations = {}, allocations = [];
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    const pointerLast = new Map();
    let cursorDistance = 0;
    const cleanup = [];
    const media = matchMedia('(prefers-reduced-motion: reduce)');

    function random() {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296;
    }
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    }
    function program(name, body) {
      const vertex = compile(gl.VERTEX_SHADER, VERTEX);
      const fragment = compile(gl.FRAGMENT_SHADER, HEADER + body);
      const value = gl.createProgram();
      gl.attachShader(value, vertex);
      gl.attachShader(value, fragment);
      gl.linkProgram(value);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(value));
      programs[name] = value;
      locations[name] = {};
    }
    function use(name, uniforms) {
      const p = programs[name];
      gl.useProgram(p);
      Object.entries(uniforms).forEach(([key, value]) => {
        const loc = key in locations[name] ? locations[name][key] :
          (locations[name][key] = gl.getUniformLocation(p, key));
        if (loc === null) return;
        if (Array.isArray(value)) {
          if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
          else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
        } else if (Number.isInteger(value) && ['field','glass','source','velocity','deformation','surface','dye','bloom','wideBloom','curl','pressure','divergence'].includes(key)) gl.uniform1i(loc, value);
        else gl.uniform1f(loc, value);
      });
    }
    function target(width, height) {
      const texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
      const result = { texture, framebuffer, width, height };
      allocations.push(result);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Fluid framebuffer incomplete');
      }
      return result;
    }
    function pair(width, height) {
      return { read: target(width,height), write: target(width,height), swap() { [this.read,this.write]=[this.write,this.read]; } };
    }
    function bindTexture(slot, t) {
      gl.activeTexture(gl.TEXTURE0+slot);
      gl.bindTexture(gl.TEXTURE_2D,t.texture);
    }
    function draw(t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,t?.framebuffer || null);
      gl.viewport(0,0,t?.width || canvas.width,t?.height || canvas.height);
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    function clear(t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,t.framebuffer);
      gl.viewport(0,0,t.width,t.height);
      gl.clearColor(0,0,0,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    function dropTargets() {
      for (const t of allocations) { gl.deleteFramebuffer(t.framebuffer); gl.deleteTexture(t.texture); }
      allocations.length = 0;
    }
    function dimensions() {
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(1,rect.width || canvas.clientWidth || 640);
      const cssH = Math.max(1,rect.height || canvas.clientHeight || 360);
      const dpr = Math.min(window.devicePixelRatio || 1,1.5);
      const factor = Math.min(dpr,Math.sqrt(1600000/(cssW*cssH)),maxTextureSize/cssW,maxTextureSize/cssH);
      const width = Math.max(1,Math.floor(cssW*factor)), height = Math.max(1,Math.floor(cssH*factor));
      return {width,height};
    }
    function allocate(force = false) {
      const size = dimensions();
      if (!force && canvas.width === size.width && canvas.height === size.height) return false;
      canvas.width = size.width; canvas.height = size.height;
      const aspect = size.width/size.height;
      const ratio = Math.max(aspect,1/aspect);
      const narrow = canvas.getBoundingClientRect().width < 620;
      const shortSim = Math.min(narrow?144:192,Math.sqrt(85000/ratio),maxTextureSize/ratio);
      const shortDye = Math.min(narrow?512:768,Math.sqrt((narrow?550000:1100000)/ratio),maxTextureSize/ratio);
      simWidth = Math.max(2,Math.floor(shortSim*Math.max(1,aspect)));
      simHeight = Math.max(2,Math.floor(shortSim*Math.max(1,1/aspect)));
      dyeWidth = Math.max(2,Math.floor(shortDye*Math.max(1,aspect)));
      dyeHeight = Math.max(2,Math.floor(shortDye*Math.max(1,1/aspect)));
      dropTargets();
      velocity=pair(simWidth,simHeight); dye=pair(dyeWidth,dyeHeight); pressure=pair(simWidth,simHeight);
      // Resolve the fine light pattern on the display grid, not the dye grid.
      composition=target(size.width,size.height);
      deformation=pair(simWidth,simHeight);
      opticalA=target(simWidth,simHeight); opticalB=target(simWidth,simHeight);
      divergence=target(simWidth,simHeight); curl=target(simWidth,simHeight);
      glowA=target(Math.max(2,Math.floor(size.width/4)),Math.max(2,Math.floor(size.height/4)));
      glowB=target(glowA.width,glowA.height);
      wideA=target(Math.max(2,Math.floor(size.width/16)),Math.max(2,Math.floor(size.height/16)));
      wideB=target(wideA.width,wideA.height);
      for (const t of allocations) clear(t);
      seedComposition();
      return true;
    }
    function inject(x,y,dx,dy,color,radius = 0.0005,start = [x,y],startColor = color) {
      const aspect = canvas.width/canvas.height;
      radius*=tuning.trailWidth*tuning.trailWidth;
      const force=[dx*tuning.cursorForce,dy*tuning.cursorForce,0];
      bindTexture(0,velocity.read);
      use('splat',{source:0,point:[x,y],start,color:force,startColor:force,radius,aspect}); draw(velocity.write); velocity.swap();
      bindTexture(0,dye.read);
      use('splat',{source:0,point:[x,y],start,color:color.map(c=>c*tuning.dyeBrightness),startColor:startColor.map(c=>c*tuning.dyeBrightness),radius,aspect}); draw(dye.write); dye.swap();
    }
    function injectVortex(x,y) {
      const aspect=canvas.width/canvas.height, shortSide=Math.min(aspect,1);
      const uniforms={source:0,center:[x,y],aspect,radius:.06*shortSide*tuning.trailWidth,
        velocityScale:[simWidth/aspect*shortSide,simHeight*shortSide],spin:.5*tuning.cursorForce,
        color:cursorColor(cursorDistance).map(value=>value*1.6*tuning.dyeBrightness)};
      bindTexture(0,velocity.read);
      use('vortex',{...uniforms,velocityPass:1}); draw(velocity.write); velocity.swap();
      bindTexture(0,dye.read);
      use('vortex',{...uniforms,velocityPass:0}); draw(dye.write); dye.swap();
    }
    const PALETTE = [[0.06,0.63,0.59],[0.09,0.25,0.84],[1.14,0.36,0.09],[0.57,0.76,0.82]];
    const LIGHT_PALETTES = [
      [[.045,.31,.56],[1,.43,.12],[.54,.72,.82]],
      [[.10,.16,.64],[.92,.20,.39],[.71,.62,.86]],
      [[.03,.45,.30],[.12,.67,.83],[.58,.83,.73]],
      [[.35,.08,.57],[1,.60,.16],[.79,.65,.82]],
      [[.07,.48,.72],[.57,.19,.78],[.64,.77,.92]],
      [[.04,.37,.43],[1,.30,.20],[.82,.71,.69]]
    ];
    function chooseComposition() {
      const previousStock=stockBaseline;
      randomState=seed;
      lightPhase=random()*6.28;
      lightStyle={waveA:[-.19,1,1],waveB:[.09,920,1],flowSpeed:0,
        tintA:LIGHT_PALETTES[0][0],tintB:LIGHT_PALETTES[0][1],tintMist:LIGHT_PALETTES[0][2]};
      palette=PALETTE;
      if(options.randomized) {
        const colors=LIGHT_PALETTES[Math.floor(random()*LIGHT_PALETTES.length)];
        lightStyle={waveA:[-1.15+random()*2.3,.28+random()*.30,.42+random()*.26],
          waveB:[.075+random()*.055,680+random()*260,.85+random()*.30],flowSpeed:.018,
          tintA:colors[0],tintB:colors[1],tintMist:colors[2]};
        palette=[colors[0].map(v=>v*1.4),colors[0].map((v,i)=>v*.55+colors[1][i]*.45),
          colors[1].map(v=>v*1.14),colors[2]];
      }
      canvas.dataset.seed=String(seed);
      stockBaseline=stockLook();
      if(look.front!==FRONT_IDLE) {
        // An exit front heads for stock light; after a reset that is the new seed's.
        if(previousStock&&sameLook(look.target,previousStock)) look.target=copyLook(stockBaseline);
        lightStyle={...lightStyle,tintA:[...look.base.a],tintB:[...look.base.b],tintMist:[...look.base.mist]};
        palette=look.target.palette.map(color=>[...color]);
      } else if(look.override) applyLook(look.override);
      else { look.base=copyLook(stockBaseline); look.target=copyLook(stockBaseline); }
    }
    function cursorColor(distance) {
      const phase=distance*2.4;
      const index=Math.floor(phase)%palette.length;
      const fraction=phase-Math.floor(phase);
      const blend=fraction*fraction*(3-2*fraction);
      return palette[index].map((value,channel)=>(value*(1-blend)+palette[(index+1)%palette.length][channel]*blend)*0.20);
    }
    function seedComposition() {
      chooseComposition();
      streamTime=0;
      bindTexture(0,dye.read);
      const aspect=canvas.width/canvas.height, materialScale=Math.min(aspect,1);
      use('seed',{source:0,aspect,phase:lightPhase,amount:0,field:1,
        flowScale:[simWidth/aspect*materialScale,simHeight*materialScale],...lightStyle});
      draw(velocity.write); velocity.swap();
      for(let i=0;i<6;i++) simulation(1/120);
    }
    let lightPhase=0, streamTime=0;
    const STOCK_CORE=[.92,.91,.85], STOCK_COOL=[.82,.95,1.08], STOCK_WARM=[1.1,.64,.36];
    const FRONT_START=-1.05, FRONT_END=1.05, FRONT_IDLE=-9;
    const look={base:null,target:null,override:null,front:FRONT_IDLE,speed:0,width:.1,edge:[0,0,0],done:null};
    // This seed's light without any mood; exit restores it after reset or resize.
    let stockBaseline=null;
    function copyLook(value) {
      return {a:[...value.a],b:[...value.b],mist:[...value.mist],core:[...value.core],
        cool:[...value.cool],warm:[...value.warm],palette:value.palette.map(color=>[...color])};
    }
    function stockLook() {
      return copyLook({a:lightStyle.tintA,b:lightStyle.tintB,mist:lightStyle.tintMist,core:STOCK_CORE,
        cool:STOCK_COOL,warm:STOCK_WARM,palette});
    }
    const sameLook=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
    function applyLook(value) {
      look.base=copyLook(value); look.target=copyLook(value);
      lightStyle={...lightStyle,tintA:[...value.a],tintB:[...value.b],tintMist:[...value.mist]};
      palette=value.palette.map(color=>[...color]);
    }
    const shift=(value,stock)=>value.map((v,i)=>v-stock[i]);
    // Uploaded in their own use() calls, so the stock compose and display calls keep their text.
    function moodUniforms() {
      const moving=look.front!==FRONT_IDLE;
      return {moodOn:moving?1:0,coreShift:shift(look.base.core,STOCK_CORE),moodA:look.target.a,moodB:look.target.b,
        moodMist:look.target.mist,moodCore:look.target.core,moodEdge:moving?look.edge:[0,0,0],
        moodFront:look.front,moodWidth:look.width,moodDir:[1,0]};
    }
    function displayMoodUniforms() {
      return {moodOn:look.front!==FRONT_IDLE?1:0,coolShift:shift(look.base.cool,STOCK_COOL),
        warmShift:shift(look.base.warm,STOCK_WARM),moodCool:look.target.cool,moodWarm:look.target.warm};
    }
    function finishFront() {
      const done=look.done;
      look.override=copyLook(look.target); applyLook(look.override);
      look.front=FRONT_IDLE; look.speed=0; look.done=null;
      done?.();
    }
    function setLook(value, transition={}) {
      if(disposed) return;
      if(look.front!==FRONT_IDLE) finishFront();
      const next=copyLook(value);
      if(transition.type==='cut' || paused || hidden) {
        look.override=next; applyLook(next); render(); transition.done?.(); return;
      }
      look.target=next; look.front=FRONT_START; look.speed=transition.speed||.45;
      look.width=transition.width||.1; look.edge=[...(transition.edge||[0,0,0])]; look.done=transition.done||null;
      palette=next.palette.map(color=>[...color]);
    }
    function clearLook() { look.override=null; }
    function getLook() { return copyLook(look.base); }
    function getStockLook() { return copyLook(stockBaseline); }
    const frameHooks=[];
    // Async flow probe: PIXEL_PACK_BUFFER plus a fence, polled once per frame.
    // A synchronous readPixels stalls the frame by about 23 ms on an M4 Air.
    let probePoints=[], probeResult=null, probeBuffer=null, probeFence=null, probeIssued=0, probePending=null;
    function probePoll() {
      if(!probeFence) return;
      const status=gl.clientWaitSync(probeFence,0,0);
      if(status!==gl.ALREADY_SIGNALED && status!==gl.CONDITION_SATISFIED) return;
      const n=probePending.length, out=new Float32Array(n*8);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,probeBuffer); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,out); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
      gl.deleteSync(probeFence); probeFence=null;
      probeResult={frame:probeIssued,samples:probePending.map((point,i)=>({point,
        // Solver texels per sim-second, converted to uv per real second.
        velocity:[out[i*8]/simWidth*.45,out[i*8+1]/simHeight*.45],
        light:[out[i*8+4],out[i*8+5],out[i*8+6]]}))};
    }
    function probeIssue() {
      if(probeFence || !probePoints.length) return;
      const n=probePoints.length;
      if(!probeBuffer) probeBuffer=gl.createBuffer();
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER,probeBuffer);
      gl.bufferData(gl.PIXEL_PACK_BUFFER,n*8*4,gl.STREAM_READ);
      probePoints.forEach(([x,y],i)=>{
        const cx=Math.max(0,Math.min(1,x)), cy=Math.max(0,Math.min(1,y));
        gl.bindFramebuffer(gl.FRAMEBUFFER,velocity.read.framebuffer);
        gl.readPixels(Math.min(simWidth-1,Math.floor(cx*simWidth)),Math.min(simHeight-1,Math.floor(cy*simHeight)),1,1,gl.RGBA,gl.FLOAT,i*32);
        gl.bindFramebuffer(gl.FRAMEBUFFER,wideA.framebuffer);
        gl.readPixels(Math.min(wideA.width-1,Math.floor(cx*wideA.width)),Math.min(wideA.height-1,Math.floor(cy*wideA.height)),1,1,gl.RGBA,gl.FLOAT,i*32+16);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
      probeFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0); gl.flush();
      probeIssued=frames; probePending=probePoints.map(point=>[...point]);
    }
    // After each simulated frame: issue the async probe, then run frame hooks.
    function afterFrame(dt) {
      probeIssue();
      for(const hook of [...frameHooks]) {
        try { hook({frames,dt:dt/.45,simDt:dt}); } catch(error) { console.error(error); }
      }
    }
    function releaseProbe() {
      if(probeFence) gl.deleteSync(probeFence);
      if(probeBuffer) gl.deleteBuffer(probeBuffer);
      probeFence=null; probeBuffer=null; probeResult=null;
    }
    // Unit direction of the strand centerline in uv, a JS port of the seed shader.
    // GLSL's mat2 is column-major, so the rotation signs match the shader's q and world.
    function ambientDirection(x,y) {
      const aspect=canvas.width/canvas.height, m=Math.min(aspect,1);
      const px=(x-.5)*aspect/m, py=(y-.5)/m;
      const angle=lightStyle.waveA[0]+.10*Math.sin(lightPhase), c=Math.cos(angle), s=Math.sin(angle);
      const qx=c*px+s*py, f=lightStyle.waveA[2], ph=lightPhase;
      const slope=lightStyle.waveA[1]*f*(.52*Math.cos(qx*4*f+.85+ph*.3)+.525*Math.cos(qx*7*f-1)-.175*Math.cos(qx*5*f+ph+1));
      const wx=c-s*slope, wy=s+c*slope, len=Math.hypot(wx,wy)||1;
      return [wx/len*m/aspect, wy/len*m];
    }
    function composeLight() {
      // Only pointer color lives in dye history. Ambient light has no feedback.
      // Contiguous taps reject grid ripples; stretching sparse taps passes them.
      bindTexture(0,deformation.read); use('wideBlur',{source:0,offset:[1/simWidth,0]}); draw(opticalB);
      bindTexture(0,opticalB); use('wideBlur',{source:0,offset:[0,1/simHeight]}); draw(opticalA);
      bindTexture(0,dye.read); bindTexture(1,opticalA);
      use('seed',{source:0,deformation:1,warp:1,glass:material==='glass'?1:0,
        aspect:canvas.width/canvas.height,streamTime,phase:lightPhase,amount:1.5,field:0,...lightStyle});
      draw(composition);
    }
    function simulation(dt) {
      const texel=[1/simWidth,1/simHeight];
      bindTexture(0,velocity.read); use('curl',{velocity:0,texel}); draw(curl);
      bindTexture(0,velocity.read); bindTexture(1,curl);
      use('vorticity',{velocity:0,curl:1,texel,dt,strength:12*tuning.curlStrength}); draw(velocity.write); velocity.swap();
      bindTexture(0,velocity.read); use('divergence',{velocity:0,texel}); draw(divergence);
      clear(pressure.read);
      for(let i=0;i<18;i++) {
        bindTexture(0,pressure.read); bindTexture(1,divergence);
        use('pressure',{pressure:0,divergence:1,texel}); draw(pressure.write); pressure.swap();
      }
      bindTexture(0,pressure.read); bindTexture(1,velocity.read);
      use('gradient',{pressure:0,velocity:1,texel}); draw(velocity.write); velocity.swap();
      bindTexture(0,velocity.read); bindTexture(1,velocity.read);
      use('advection',{velocity:0,source:1,texel,dt,dissipation:0.18}); draw(velocity.write); velocity.swap();
      bindTexture(0,velocity.read); bindTexture(1,dye.read);
      // One filtered forward pass avoids rebuilding sharp contours as dye ages.
      use('advection',{velocity:0,source:1,texel,dt,dissipation:Math.LN2/(tuning.fadeTime*.45)});
      draw(dye.write); dye.swap();
      bindTexture(0,deformation.read); bindTexture(1,velocity.read);
      // Only low-frequency coordinates have history, never the light itself.
      use('deformation',{source:0,velocity:1,texel,dt,aspect:canvas.width/canvas.height});
      draw(deformation.write); deformation.swap();
    }
    function render() {
      if (disposed || contextLost) return;
      if (allocate()) return render();
      use('seed',moodUniforms()); use('display',displayMoodUniforms());
      composeLight();
      if (material==='glass') {
        // Composition has consumed the optical flow map; reuse its scratch targets.
        bindTexture(0,composition); use('surface',{source:0,footprint:[1/simWidth,1/simHeight]}); draw(opticalB);
        bindTexture(0,opticalB); use('blur',{source:0,offset:[1.25/simWidth,0]}); draw(opticalA);
        bindTexture(0,opticalA); use('blur',{source:0,offset:[0,1.25/simHeight]}); draw(opticalB);
      }
      bindTexture(0,composition);
      use('bloom',{dye:0,glass:material==='glass'?1:0,texel:[1/composition.width,1/composition.height]}); draw(glowA);
      bindTexture(0,glowA); use('blur',{source:0,offset:[1/glowA.width,0]}); draw(glowB);
      bindTexture(0,glowB); use('blur',{source:0,offset:[0,1/glowA.height]}); draw(glowA);
      bindTexture(0,glowA); use('downsample',{source:0,sourceFootprint:[1/wideA.width,1/wideA.height]}); draw(wideA);
      bindTexture(0,wideA); use('wideBlur',{source:0,offset:[1/wideA.width,0]}); draw(wideB);
      bindTexture(0,wideB); use('wideBlur',{source:0,offset:[0,1/wideA.height]}); draw(wideA);
      bindTexture(0,composition); bindTexture(1,glowA); bindTexture(2,wideA); bindTexture(3,opticalB);
      use('display',{dye:0,bloom:1,wideBloom:2,surface:3,surfaceTexel:[1/simWidth,1/simHeight],
        texel:[1/composition.width,1/composition.height],glass:material==='glass'?1:0,glowStrength:tuning.glowStrength}); draw(null);
    }
    function schedule() { if (!disposed && !contextLost && !paused && !hidden && !raf) raf=requestAnimationFrame(tick); }
    function tick(now) {
      raf=0;
      if (disposed || contextLost || paused || hidden) return;
      try {
      const dt=Math.min(Math.max((now-lastTime)/1000,0),1/30)*.45;
      lastTime=now;
      if (allocate()) lastTime=now;
      probePoll();
      simulation(dt);
      streamTime+=dt;
      if(look.front!==FRONT_IDLE) {
        look.front+=look.speed*dt/.45;
        if(look.front>=FRONT_END) finishFront();
      }
      frames++; canvas.dataset.frames=String(frames);
      render(); schedule();
      afterFrame(dt);
      } catch(error) { fail(error); }
    }
    function setPaused(value) {
      if (disposed) return;
      if(paused!==!!value) pointerLast.clear();
      paused=!!value; canvas.dataset.paused=String(paused);
      if (paused) { cancelAnimationFrame(raf); raf=0; }
      else { lastTime=performance.now(); schedule(); }
      options.onPauseChange?.(paused);
    }
    function setMaterial(value) {
      if (disposed) return;
      if (value!=='ink' && value!=='glass') throw new TypeError('Material must be ink or glass');
      material=value; canvas.dataset.material=value; render();
    }
    function getTuning() { return {...tuning}; }
    function setTuning(patch) {
      if(disposed) return getTuning();
      const oldGlow=tuning.glowStrength;
      tuning=validateTuning(tuning,patch);
      if(paused && oldGlow!==tuning.glowStrength) render();
      return getTuning();
    }
    function reset(nextSeed) {
      if (disposed) return;
      seed=Number.isFinite(nextSeed)?nextSeed>>>0:(seed+0x9e3779b9)>>>0;
      pointerLast.clear(); cursorDistance=0; interactions=0;
      canvas.dataset.interactions='0';
      lastTime=performance.now();
      for (const t of allocations) clear(t);
      seedComposition(); render();
    }
    function local(event) {
      const rect=canvas.getBoundingClientRect();
      return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),
        y:1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))};
    }
    function pointerMove(event) {
      if (disposed || paused || hidden || !pointerLast.has(event.pointerId)) return;
      if(event.pointerType!=='touch' && !(event.buttons&1)) { pointerEnd(event); return; }
      const pos=local(event), old=pointerLast.get(event.pointerId);
      pointerLast.set(event.pointerId,pos);
      if (!old) return;
      const dx=(pos.x-old.x)*canvas.width/canvas.height,dy=pos.y-old.y;
      const length=Math.hypot(dx,dy);
      if (length<0.0001) return;
      // The integrated brush already accounts for path length. A unit direction
      // keeps total momentum independent of the pointer event sampling rate.
      const velocityScale=event.pointerType==='touch'?130:110;
      const startColor=cursorColor(cursorDistance);
      cursorDistance+=length;
      const color=cursorColor(cursorDistance);
      inject(pos.x,pos.y,dx/length*velocityScale,dy/length*velocityScale,color,0.00028,[old.x,old.y],startColor);
      interactions++; canvas.dataset.interactions=String(interactions);
    }
    function pointerDown(event) {
      if(disposed || paused || hidden || event.button!==0 || pointerLast.has(event.pointerId)) return;
      const pos=local(event);
      pointerLast.set(event.pointerId,pos);
      // Capture keeps release events attached to the canvas outside its bounds.
      // Synthetic regression events have no active pointer and cannot capture.
      try { canvas.setPointerCapture?.(event.pointerId); } catch (_) {}
      if(event.pointerType==='touch') event.preventDefault();
      injectVortex(pos.x,pos.y);
      interactions++; canvas.dataset.interactions=String(interactions);
    }
    function pointerEnd(event) { pointerLast.delete(event.pointerId); }
    function keydown(event) {
      if(disposed) return;
      const key=event.code || event.key;
      if ((key==='Space' || key===' ') && options.pauseOnSpace!==false) { event.preventDefault(); setPaused(!paused); return; }
      if(paused || hidden) return;
      const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[key];
      if (!direction) return;
      event.preventDefault();
      inject(0.5,0.5,direction[0]*80,direction[1]*80,palette[interactions%palette.length].map(v=>v*0.28),0.0008);
      interactions++; canvas.dataset.interactions=String(interactions);
    }
    function on(target,type,handler,opts) {
      target.addEventListener(type,handler,opts);
      cleanup.push(()=>target.removeEventListener(type,handler,opts));
    }
    function dispose() {
      if(disposed) return;
      disposed=true; cancelAnimationFrame(raf); raf=0;
      releaseProbe(); frameHooks.length=0; look.done=null;
      for(const fn of cleanup) fn();
      dropTargets();
      for(const value of Object.values(programs)) gl.deleteProgram(value);
      gl.deleteVertexArray(vao);
      canvas.dataset.state='disposed';
    }
    function fail(error) {
      dispose();
      canvas.dataset.state='error';
      options.onError?.(error);
    }
    try {
      for(const [name,body] of Object.entries(SHADERS)) program(name,body);
      allocate(true);
      canvas.dataset.frames='0'; canvas.dataset.interactions='0';
      canvas.dataset.paused=String(paused); canvas.dataset.material=material; canvas.dataset.state='ready';
      if(options.interactive!==false) {
        canvas.style.touchAction='none';
        if(!canvas.hasAttribute('tabindex')) canvas.tabIndex=0;
        on(canvas,'pointerdown',pointerDown);
        on(canvas,'pointermove',pointerMove);
        on(canvas,'pointerup',pointerEnd);
        on(canvas,'pointercancel',pointerEnd);
        on(canvas,'pointerleave',pointerEnd);
        on(canvas,'lostpointercapture',pointerEnd);
        on(window,'blur',()=>pointerLast.clear());
        on(canvas,'keydown',keydown);
      }
      on(canvas,'webglcontextlost',event=>{
        event.preventDefault();
        contextLost=true;
        fail(new Error('WebGL context lost'));
      });
      on(document,'visibilitychange',()=>{hidden=document.hidden; pointerLast.clear(); if(hidden){cancelAnimationFrame(raf);raf=0;} else {lastTime=performance.now();schedule();}});
      on(window,'resize',()=>{
        if(disposed || hidden || contextLost) return;
        try { allocate(); render(); } catch(error) { fail(error); }
      });
      on(media,'change',event=>setPaused(event.matches));
      render(); schedule();
    } catch(error) {
      canvas.dataset.state='error';
      options.onError?.(error);
      dispose();
      canvas.dataset.state='error';
      throw error;
    }
    return {setPaused,setMaterial,render,reset,dispose,setTuning,getTuning,
      setLook,clearLook,getLook,getStockLook,ambientDirection,
      isPaused:()=>paused,
      setProbePoints(points){probePoints=points.map(point=>[point[0],point[1]]);},
      readProbe(){return probeResult;},
      onFrame(hook){frameHooks.push(hook);return()=>{const i=frameHooks.indexOf(hook); if(i>=0) frameHooks.splice(i,1);};}};
  }

  window.FluidPrototype={create,tuningSchema};
})();
