'use strict';
const palettes = {
  nebula:[[8,12,38],[56,32,121],[157,56,170],[244,124,176],[255,224,200],[91,65,178]],
  ocean:[[5,16,40],[14,53,109],[14,126,164],[87,218,226],[227,255,241],[29,119,177]],
  ember:[[25,8,25],[111,23,58],[219,62,35],[253,156,47],[255,239,178],[187,67,46]],
  forest:[[5,23,27],[13,75,70],[35,132,104],[111,202,147],[227,248,188],[49,137,122]],
  mono:[[8,13,22],[57,66,79],[121,133,146],[208,218,228],[250,250,250],[101,114,132]]
};
self.onmessage = event => {
  try {
    const {width,height,settings:s} = event.data;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || width*height>8294400 || !palettes[s.palette] || !['julia','mandelbrot','ship'].includes(s.fractal) || ![160,400,800].includes(s.detail) || !Number.isFinite(s.zoom) || s.zoom<1 || s.zoom>40) throw new Error('Invalid render options');
    const seed = Number(s.seed) >>> 0;
    let randomState = seed || 1;
    const random = () => {randomState = (Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;};
    const colors = palettes[s.palette];
    const inside = s.amoled ? [0,0,0] : [1,3,5].map(i=>parseInt(s.background.slice(i,i+2),16));
    const phase = s.shift/360 + random()*0.3;
    const julias = [[-.7,.27015],[-.8,.156],[.285,.01],[-.4,.6],[0,.8],[-.7269,.1889]];
    const jc = julias[Math.floor(random()*julias.length)];
    let centerX = 0, centerY = 0;
    if (s.fractal === 'julia') {
      // Aim zoomed views at a repelling fixed point on the fractal boundary.
      const a=1-4*jc[0], b=-4*jc[1], magnitude=Math.hypot(a,b);
      const blend=Math.min(1,(s.zoom-1)/3);
      centerX=(1+Math.sqrt((magnitude+a)/2))/2*blend;
      centerY=Math.sign(b)*Math.sqrt((magnitude-a)/2)/2*blend;
    }
    if (s.fractal === 'mandelbrot') {
      const centers = [[-.743643887037151,.13182590420533],[-.75,.1],[-.1011,.9563]];
      const chosen = centers[Math.floor(random()*centers.length)];
      const blend = Math.min(1,(s.zoom-1)/3);
      centerX = -.5*(1-blend)+chosen[0]*blend; centerY=chosen[1]*blend;
    }
    if (s.fractal === 'ship') {
      const blend=Math.min(1,(s.zoom-1)/3);
      centerX=-.4*(1-blend)-1.7443359375*blend;
      centerY=-.4*(1-blend)-.017451171875*blend;
    }
    const radians=s.rotation*Math.PI/180, cos=Math.cos(radians), sin=Math.sin(radians);
    const span = (s.fractal === 'julia' ? 3.4 : 3.2)/s.zoom;
    const scale=span/Math.min(width,height);
    const data=new Uint8ClampedArray(width*height*4);
    const escapeValues=s.amoled ? new Float32Array(width*height) : null;
    const histogram=s.amoled ? new Uint32Array(s.detail+1) : null;
    let escaped=0;
    let lastProgress=-1;
    for (let y=0;y<height;y++) {
      const py=(y-height/2+.5)*scale;
      for (let x=0;x<width;x++) {
        const px=(x-width/2+.5)*scale;
        const cx=centerX+px*cos-py*sin, cy=centerY+px*sin+py*cos;
        let zr=s.fractal==='julia'?cx:0, zi=s.fractal==='julia'?cy:0;
        const cr=s.fractal==='julia'?jc[0]:cx, ci=s.fractal==='julia'?jc[1]:cy;
        let n=0, r2=zr*zr, i2=zi*zi;
        // Skip known Mandelbrot interiors, saving time at high resolutions.
        const q=(cx-.25)*(cx-.25)+cy*cy;
        if(s.fractal==='mandelbrot' && (q*(q+cx-.25)<=.25*cy*cy || (cx+1)*(cx+1)+cy*cy<=.0625)) n=s.detail;
        while(n<s.detail && r2+i2<=256) {
          if(s.fractal==='ship'){zr=Math.abs(zr);zi=Math.abs(zi);}
          zi=2*zr*zi+ci; zr=r2-i2+cr; r2=zr*zr; i2=zi*zi; n++;
        }
        const offset=(y*width+x)*4;
        if(n>=s.detail) {
          data[offset]=inside[0];data[offset+1]=inside[1];data[offset+2]=inside[2];
          if(escapeValues)escapeValues[y*width+x]=-1;
        }
        else {
          const smooth=n+1-Math.log2(Math.log2(Math.max(2,r2+i2))/2);
          if(escapeValues){
            const value=Math.max(0,Math.min(s.detail-1,smooth));
            escapeValues[y*width+x]=value;histogram[Math.floor(value)]++;escaped++;
          }
          const t=((smooth*.024+phase)%1+1)%1*colors.length;
          const index=Math.floor(t), f=t-index;
          // Smooth palette interpolation avoids hard color bands in PNG exports.
          const blend=f*f*(3-2*f), a=colors[index], b=colors[(index+1)%colors.length];
          for(let c=0;c<3;c++)data[offset+c]=a[c]+(b[c]-a[c])*blend;
        }
        data[offset+3]=255;
      }
      const progress=Math.floor((y+1)/height*(s.amoled?90:100));
      if(progress!==lastProgress && progress%2===0){self.postMessage({type:'progress',progress});lastProgress=progress;}
    }
    if(escapeValues && escaped) {
      // Keep the most detailed boundaries colorful; make broad quiet areas
      // actual RGB(0,0,0), rather than merely darkening the whole wallpaper.
      function quantile(fraction) {
        let count=0;
        for(let i=0;i<histogram.length;i++){count+=histogram[i];if(count>=escaped*fraction)return i+1;}
        return s.detail;
      }
      const black=quantile(.6), bright=Math.max(black+1,quantile(.85));
      for(let y=0;y<height;y++){
        for(let x=0;x<width;x++){
          const pixel=y*width+x, offset=pixel*4;
          const t=Math.max(0,Math.min(1,(escapeValues[pixel]-black)/(bright-black)));
          const strength=t*t*(3-2*t);
          for(let c=0;c<3;c++)data[offset+c]=Math.round(data[offset+c]*strength);
        }
        const progress=90+Math.floor((y+1)/height*10);
        if(progress!==lastProgress){self.postMessage({type:'progress',progress});lastProgress=progress;}
      }
    }
    self.postMessage({type:'complete',width,height,pixels:data.buffer},[data.buffer]);
  } catch (error) {self.postMessage({type:'error',message:error.message});}
};
