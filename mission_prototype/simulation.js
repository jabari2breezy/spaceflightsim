const { Engine, Render, Runner, Bodies, Composite, Body, Events, Vector } = Matter;

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const MOON_POS = { x: 8000, y: -40000 };
const MOON_RADIUS = 1500;
const EARTH_GRAVITY = 0.001;
const MOON_GRAVITY = 0.0003;
const ROCKET_THRUST = 0.003;

let state = 'STANDBY'; 
let timeWarp = 1;
let zoom = 2.0; 
let targetZoom = 2.0;
let throttle = 0;
let missionTime = 0;

const app = new PIXI.Application({
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: 0x020205,
    resizeTo: window,
    antialias: true
});
document.getElementById('canvas-container').appendChild(app.view);

const worldContainer = new PIXI.Container();
app.stage.addChild(worldContainer);

const engine = Engine.create();
engine.world.gravity.y = 0; 

const ground = Bodies.rectangle(0, 250, 20000, 500, { isStatic: true, friction: 1 });
Composite.add(engine.world, ground);

const groundGfx = new PIXI.Graphics();
groundGfx.beginFill(0x0f2a10);
groundGfx.drawRect(-10000, 0, 20000, 500);
groundGfx.endFill();
for(let i=0; i<15000; i++) {
    let brightness = 0x20 + Math.floor(Math.random()*0x30);
    let color = (0x00 << 16) | (brightness << 8) | 0x00;
    groundGfx.lineStyle(1, color, 0.6);
    let gx = -10000 + Math.random() * 20000;
    groundGfx.moveTo(gx, 0);
    groundGfx.lineTo(gx + (Math.random() - 0.5)*20, -5 - Math.random()*15);
}
worldContainer.addChild(groundGfx);

const moon = Bodies.circle(MOON_POS.x, MOON_POS.y, MOON_RADIUS, { isStatic: true });
Composite.add(engine.world, moon);

const moonGfx = new PIXI.Graphics();
moonGfx.beginFill(0xdddddd);
moonGfx.drawCircle(0, 0, MOON_RADIUS);
moonGfx.endFill();
for(let i=0; i<200; i++) {
    let a = Math.random() * Math.PI * 2;
    let r = Math.random() * (MOON_RADIUS - 50);
    let cr = 10 + Math.random() * 120;
    moonGfx.beginFill(0xaaaaaa, 0.5);
    moonGfx.drawCircle(Math.cos(a)*r, Math.sin(a)*r, cr);
    moonGfx.endFill();
}
moonGfx.position.set(MOON_POS.x, MOON_POS.y);
worldContainer.addChild(moonGfx);

const stars = [];
for(let i=0; i<1000; i++) {
    let star = new PIXI.Graphics();
    let c = 100 + Math.random()*155;
    star.beginFill((c<<16) | (c<<8) | c, 0.4 + Math.random()*0.6);
    star.drawCircle(0,0, 0.5 + Math.random()*2.0);
    star.endFill();
    star.origX = Math.random() * WIDTH * 4;
    star.origY = Math.random() * HEIGHT * 4;
    star.z = 0.05 + Math.random() * 0.3; 
    app.stage.addChildAt(star, 0); 
    stars.push(star);
}

const ROCKET_W = 16;
const ROCKET_H = 120;
const rocket = Bodies.rectangle(0, -ROCKET_H/2, ROCKET_W, ROCKET_H, { 
    frictionAir: 0.005,
    density: 0.008
});
Composite.add(engine.world, rocket);

const rocketGfx = new PIXI.Graphics();
rocketGfx.beginFill(0xdddddd); 
rocketGfx.drawRect(-ROCKET_W/2, -ROCKET_H/2, ROCKET_W, ROCKET_H);
rocketGfx.beginFill(0x222222); 
rocketGfx.drawPolygon([-12, ROCKET_H/2, 12, ROCKET_H/2, 16, ROCKET_H/2+20, -16, ROCKET_H/2+20]);
rocketGfx.beginFill(0x3a82f7); 
rocketGfx.drawRect(-ROCKET_W/2, -ROCKET_H/2 + 20, ROCKET_W, 10);
rocketGfx.drawRect(-ROCKET_W/2, 10, ROCKET_W, 10);
rocketGfx.beginFill(0x111111);
rocketGfx.drawPolygon([-ROCKET_W/2, -ROCKET_H/2, ROCKET_W/2, -ROCKET_H/2, 0, -ROCKET_H/2 - 40]);
rocketGfx.endFill();
worldContainer.addChild(rocketGfx);

const particles = [];

const stateLabel = document.getElementById('state-label');
const altText = document.getElementById('alt-text');
const velText = document.getElementById('vel-text');
const throttleFill = document.getElementById('throttle-fill');
const throttleText = document.getElementById('throttle-text');
const startMenu = document.getElementById('start-menu');

window.addEventListener('keydown', (e) => {
    if(e.code === 'Space' && state === 'STANDBY') {
        startMission();
    }
    if(e.key === '-' || e.key === '_') targetZoom *= 0.8;
    if(e.key === '=' || e.key === '+') targetZoom *= 1.25;
    if(e.key === '<' || e.key === ',') timeWarp = Math.max(0.25, timeWarp / 2);
    if(e.key === '>' || e.key === '.') timeWarp = Math.min(16, timeWarp * 2);
    
    document.getElementById('warp-label').innerText = `TIME WARP: ${timeWarp}x`;
});

function startMission() {
    startMenu.style.display = 'none';
    state = 'COUNTDOWN';
    stateLabel.innerText = 'MISSION: COUNTDOWN';
    
    let t = 0;
    let inv = setInterval(() => {
        t += 5;
        throttle = t;
        throttleFill.style.height = `${t}%`;
        throttleText.innerText = `${t}%`;
        if(t >= 100) clearInterval(inv);
    }, 250); // 5 seconds to reach 100%
}

app.ticker.add((delta) => {
    let dt = 1000 / 60;
    let steps = Math.max(1, Math.floor(timeWarp));
    let timeScale = timeWarp / steps;
    
    for(let i=0; i<steps; i++) {
        updatePhysics(dt * timeScale);
        Engine.update(engine, dt * timeScale);
    }
    
    updateVisuals();
});

function updatePhysics(dt) {
    if(state !== 'STANDBY') {
        missionTime += dt / 1000;
    }
    let elapsed = missionTime;
    
    let distToEarth = -rocket.position.y;
    let earthForce = { x: 0, y: rocket.mass * EARTH_GRAVITY };
    
    let dx = MOON_POS.x - rocket.position.x;
    let dy = MOON_POS.y - rocket.position.y;
    let distToMoonSq = dx*dx + dy*dy;
    let distToMoon = Math.sqrt(distToMoonSq);
    
    let moonForceMag = (rocket.mass * MOON_GRAVITY * 50000000) / (distToMoonSq + 10000);
    let moonForce = { x: (dx/distToMoon)*moonForceMag, y: (dy/distToMoon)*moonForceMag };
    
    if (distToEarth < 100 && state === 'STANDBY') {
        Body.applyForce(rocket, rocket.position, earthForce); // Keep it on ground
    } else {
        Body.applyForce(rocket, rocket.position, {
            x: earthForce.x + moonForce.x,
            y: earthForce.y + moonForce.y
        });
    }

    if(state === 'COUNTDOWN') {
        spawnParticles(5, 0xaaaaaa);
        if(elapsed > 5) {
            state = 'ASCENT';
            stateLabel.innerText = 'MISSION: LIFTOFF';
            targetZoom = 0.5;
        }
    } else if (state === 'ASCENT') {
        spawnParticles(5, 0xffaa00);
        
        let force = {
            x: Math.sin(rocket.angle) * rocket.mass * ROCKET_THRUST,
            y: -Math.cos(rocket.angle) * rocket.mass * ROCKET_THRUST
        };
        Body.applyForce(rocket, rocket.position, force);
        
        if(elapsed > 10) {
            state = 'GRAVITY_TURN';
            stateLabel.innerText = 'MISSION: GRAVITY TURN';
        }
    } else if (state === 'GRAVITY_TURN') {
        spawnParticles(5, 0xffaa00);
        
        let targetAngle = Math.atan2(dy, dx) + Math.PI/2;
        let angleDiff = targetAngle - rocket.angle;
        Body.setAngularVelocity(rocket, angleDiff * 0.05);
        
        let force = {
            x: Math.sin(rocket.angle) * rocket.mass * ROCKET_THRUST,
            y: -Math.cos(rocket.angle) * rocket.mass * ROCKET_THRUST
        };
        Body.applyForce(rocket, rocket.position, force);
        
        if(elapsed > 15) {
            state = 'TLI';
            stateLabel.innerText = 'MISSION: TLI BURN';
            targetZoom = 0.1;
        }
    } else if (state === 'TLI') {
        spawnParticles(5, 0xffaa00);
        
        let targetAngle = Math.atan2(dy, dx) + Math.PI/2;
        rocket.angle = targetAngle; 
        
        let force = {
            x: Math.sin(rocket.angle) * rocket.mass * ROCKET_THRUST * 4, 
            y: -Math.cos(rocket.angle) * rocket.mass * ROCKET_THRUST * 4
        };
        Body.applyForce(rocket, rocket.position, force);
        
        if(distToMoon < 15000) {
            state = 'COAST';
            throttle = 0;
            throttleFill.style.height = `0%`;
            throttleText.innerText = `0%`;
            stateLabel.innerText = 'MISSION: COAST';
            targetZoom = 0.5;
        }
    } else if (state === 'COAST') {
        if(distToMoon < MOON_RADIUS + 2500) {
            state = 'LANDING';
            throttle = 100;
            throttleFill.style.height = `100%`;
            throttleText.innerText = `100%`;
            stateLabel.innerText = 'MISSION: POWERED DESCENT';
            targetZoom = 1.0;
        }
    } else if (state === 'LANDING') {
        spawnParticles(5, 0xffaa00);
        let velDir = Math.atan2(rocket.velocity.y, rocket.velocity.x);
        let targetAngle = velDir - Math.PI/2;
        rocket.angle = targetAngle;
        
        let speed = Math.sqrt(rocket.velocity.x**2 + rocket.velocity.y**2);
        let currentThrust = (speed > 5) ? ROCKET_THRUST * 8 : (speed > 1 ? ROCKET_THRUST * 2 : ROCKET_THRUST * 0.8);
        
        let force = {
            x: Math.sin(rocket.angle) * rocket.mass * currentThrust,
            y: -Math.cos(rocket.angle) * rocket.mass * currentThrust
        };
        Body.applyForce(rocket, rocket.position, force);
        
        if(distToMoon < MOON_RADIUS + ROCKET_H/2 + 20 && speed < 2) {
            state = 'LANDED';
            throttle = 0;
            throttleFill.style.height = `0%`;
            throttleText.innerText = `0%`;
            stateLabel.innerText = 'MISSION: TOUCHDOWN CONFIRMED';
            Body.setVelocity(rocket, {x:0, y:0});
            Body.setAngularVelocity(rocket, 0);
            rocket.angle = Math.atan2(dy, dx) - Math.PI/2; 
            targetZoom = 2.0;
        }
    }
}

function spawnParticles(count, color) {
    if(timeWarp > 4) return; 
    let basePos = {
        x: rocket.position.x - Math.sin(rocket.angle) * (ROCKET_H/2 + 20),
        y: rocket.position.y + Math.cos(rocket.angle) * (ROCKET_H/2 + 20)
    };
    
    for(let i=0; i<count; i++) {
        let p = new PIXI.Graphics();
        p.beginFill(color, 0.6 + Math.random()*0.4);
        p.drawCircle(0, 0, 5 + Math.random()*25);
        p.endFill();
        p.x = basePos.x + (Math.random()-0.5)*15;
        p.y = basePos.y + (Math.random()-0.5)*15;
        p.vx = rocket.velocity.x + (Math.random()-0.5)*8 - Math.sin(rocket.angle)*15;
        p.vy = rocket.velocity.y + (Math.random()-0.5)*8 + Math.cos(rocket.angle)*15;
        p.life = 1.0;
        p.blendMode = PIXI.BLEND_MODES.ADD;
        worldContainer.addChild(p);
        particles.push(p);
    }
}

function updateVisuals() {
    rocketGfx.position.x = rocket.position.x;
    rocketGfx.position.y = rocket.position.y;
    rocketGfx.rotation = rocket.angle;
    
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02 * timeWarp;
        p.alpha = p.life;
        p.scale.set(1 + (1-p.life)*3);
        if(p.life <= 0) {
            worldContainer.removeChild(p);
            p.destroy();
            particles.splice(i, 1);
        }
    }
    
    zoom += (targetZoom - zoom) * 0.05;
    worldContainer.scale.set(zoom);
    worldContainer.position.x = WIDTH/2 - rocket.position.x * zoom;
    worldContainer.position.y = HEIGHT/2 - rocket.position.y * zoom;
    
    let camX = worldContainer.position.x;
    let camY = worldContainer.position.y;
    stars.forEach(s => {
        let sx = (s.origX + camX * s.z) % WIDTH;
        let sy = (s.origY + camY * s.z) % HEIGHT;
        if(sx < 0) sx += WIDTH;
        if(sy < 0) sy += HEIGHT;
        s.position.set(sx, sy);
    });
    
    let alt = -rocket.position.y - (ROCKET_H/2);
    if(alt < 0) alt = 0;
    if(state === 'LANDED' || state === 'LANDING' || state === 'COAST') {
        let dx = MOON_POS.x - rocket.position.x;
        let dy = MOON_POS.y - rocket.position.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        alt = dist - MOON_RADIUS - (ROCKET_H/2);
        if (alt < 0) alt = 0;
    }
    altText.innerText = `Altitude: ${(alt/1000).toFixed(2)} km`;
    
    let vel = Math.sqrt(rocket.velocity.x**2 + rocket.velocity.y**2);
    velText.innerText = `Velocity: ${vel.toFixed(1)} m/s`;
}
