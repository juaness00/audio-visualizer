import type { Renderer } from '../renderer';



const MAX_PARTICLES = 240;
const BANDS = 4;
const THRESHOLD = 0.18;
const MAX_SPAWN = 3;
const TAU = Math.PI * 2;


const pool = Array.from({ length: MAX_PARTICLES }, () => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  age: 0,
  life: 0,
  band: 0,
}));

function spawn(band: number, energy: number, width: number, height: number): void {
    for(let i = 0; i < MAX_PARTICLES; i++){
        const p = pool[i];
        if(!p || p.age < p.life){
            continue;
        } 
        p.x = ((band + 0.5)/BANDS)*width;
        p.y = height;
        p.vx = (Math.random()-0.5)*energy*0.012;
        p.vy = -energy*0.02;
        p.age = 0;
        p.life = 60;
        p.band = band;
        return;

    }
}

export const particles: Renderer = {
    id: 'particles', 
    draw(ctx, frame, settings){
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        if(width === 0 || height === 0)
            return;
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(12,12,16,0.22)';
        ctx.fillRect(0,0, width, height);
        const size = Math.floor(frame.bins.length/BANDS);

        for(let band =0 ; band < BANDS; band ++ ){
            let total = 0;
            for(let i = band*size; i < (band+1)*size; i++ ){
                total += frame.bins[i] ?? 0;
                
            }
            const energy = Math.min((total/size/255)*settings.gain,1);
        
            if(energy < THRESHOLD )
                continue
            for(let n = 0; n < Math.round(energy*MAX_SPAWN); n++){
                spawn(band,energy,width, height);

            }

        }
        for(let i = 0; i < MAX_PARTICLES; i++){
            const p = pool[i];
            if(!p || p.age >= p.life)
                continue;
            p.x += p.vx*width;
            p.y += p.vy*height;
            p.age += 1;
            ctx.globalAlpha = 1 - p.age/p.life;
            ctx.fillStyle = settings.palette[p.band % settings.palette.length] ?? '#FFFFFF';
            ctx.beginPath();
            ctx.arc(p.x,p.y,height*0.006, 0, TAU);
            ctx.fill();

        }

        ctx.globalAlpha = 1;

    }
}
