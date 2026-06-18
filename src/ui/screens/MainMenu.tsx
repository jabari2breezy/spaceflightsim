import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Screen } from '../../App';

interface MainMenuProps {
  onNavigate: (screen: Screen) => void;
}

const DESTINATIONS = [
  { id: 'earth', name: 'Earth', planetClass: 'planet-earth', detail: 'Home' },
  { id: 'moon', name: 'Moon', planetClass: 'planet-moon', detail: 'Nearest body' },
  { id: 'mars', name: 'Mars', planetClass: 'planet-mars', detail: 'Red Planet' },
];

const MainMenu: React.FC<MainMenuProps> = ({ onNavigate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.01, 0.02, 0.03, 1);

    const camera = new BABYLON.ArcRotateCamera('cam', -0.8, 1.2, 14, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 6;
    camera.upperRadiusLimit = 30;
    camera.inertia = 0.9;
    camera.panningSensibility = 0;

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, -1), scene);
    hemi.intensity = 0.3;
    hemi.diffuse = new BABYLON.Color3(0.05, 0.15, 0.25);

    const rim = new BABYLON.DirectionalLight('rim', new BABYLON.Vector3(-0.5, 0.8, 1), scene);
    rim.intensity = 1.2;
    rim.diffuse = new BABYLON.Color3(0, 1, 0.7);

    const fill = new BABYLON.DirectionalLight('fill', new BABYLON.Vector3(0.5, 0.2, -1), scene);
    fill.intensity = 0.4;
    fill.diffuse = new BABYLON.Color3(0.4, 0.2, 0.8);

    const earth = BABYLON.MeshBuilder.CreateSphere('earth', { diameter: 2.4, segments: 64 }, scene);
    const earthMat = new BABYLON.PBRMetallicRoughnessMaterial('earthMat', scene);
    earthMat.baseColor = new BABYLON.Color3(0.12, 0.35, 0.75);
    earthMat.metallic = 0.0;
    earthMat.roughness = 0.5;
    earth.material = earthMat;

    const earthPos = earth.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (earthPos) {
      const colors: number[] = [];
      for (let i = 0; i < earthPos.length / 3; i++) {
        const x = earthPos[i * 3] / 1.2;
        const y = earthPos[i * 3 + 1] / 1.2;
        const z = earthPos[i * 3 + 2] / 1.2;
        const noise = Math.sin(x * 10 + y * 6) * Math.cos(y * 8 + z * 5) +
                      Math.sin(z * 7 + x * 4) * 0.4;
        if (noise > 0.2) {
          const e = (noise - 0.2) * 0.3;
          colors.push(0.15 + e, 0.4 + e * 0.6, 0.1 + e * 0.2, 1);
        } else {
          colors.push(0.08, 0.2, 0.55, 1);
        }
      }
      earth.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    }
    earth.rotation.x = 0.4;
    earth.rotation.z = 0.15;

    const atmo = BABYLON.MeshBuilder.CreateSphere('atmo', { diameter: 2.5, segments: 32 }, scene);
    const atmoMat = new BABYLON.StandardMaterial('atmoMat', scene);
    atmoMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 1);
    atmoMat.alpha = 0.06;
    atmoMat.backFaceCulling = false;
    atmoMat.disableLighting = true;
    atmoMat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.8);
    atmo.material = atmoMat;
    atmo.isPickable = false;

    const stars = new BABYLON.ParticleSystem('stars', 3000, scene);
    stars.emitter = BABYLON.Vector3.Zero();
    stars.minEmitBox = new BABYLON.Vector3(-40, -40, -40);
    stars.maxEmitBox = new BABYLON.Vector3(40, 40, 40);
    stars.color1 = new BABYLON.Color4(0.7, 0.8, 1, 0.9);
    stars.color2 = new BABYLON.Color4(0.9, 1, 1, 0.5);
    stars.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    stars.minSize = 0.03;
    stars.maxSize = 0.12;
    stars.minLifeTime = 9999;
    stars.maxLifeTime = 9999;
    stars.emitRate = 10;
    stars.createSphereEmitter(40);
    stars.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    stars.gravity = BABYLON.Vector3.Zero();
    stars.direction1 = BABYLON.Vector3.Zero();
    stars.direction2 = BABYLON.Vector3.Zero();
    stars.minEmitPower = 0;
    stars.maxEmitPower = 0;
    stars.updateSpeed = 0.01;
    stars.start();

    const ring = BABYLON.MeshBuilder.CreateTorus('ring', { diameter: 4.5, thickness: 0.02, tessellation: 64 }, scene);
    ring.rotation.x = 1.2;
    ring.rotation.z = 0.3;
    const ringMat = new BABYLON.StandardMaterial('ringMat', scene);
    ringMat.emissiveColor = new BABYLON.Color3(0, 0.7, 0.55);
    ringMat.alpha = 0.2;
    ringMat.disableLighting = true;
    ring.material = ringMat;

    const ringParticles = new BABYLON.ParticleSystem('orbParticles', 60, scene);
    ringParticles.emitter = BABYLON.Vector3.Zero();
    ringParticles.minEmitBox = BABYLON.Vector3.Zero();
    ringParticles.maxEmitBox = BABYLON.Vector3.Zero();
    ringParticles.color1 = new BABYLON.Color4(0, 0.8, 0.6, 0.5);
    ringParticles.color2 = new BABYLON.Color4(0, 0.5, 0.4, 0.2);
    ringParticles.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ringParticles.minSize = 0.06;
    ringParticles.maxSize = 0.12;
    ringParticles.minLifeTime = 8;
    ringParticles.maxLifeTime = 14;
    ringParticles.emitRate = 6;
    ringParticles.createSphereEmitter(4.5);
    ringParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ringParticles.gravity = BABYLON.Vector3.Zero();
    ringParticles.direction1 = new BABYLON.Vector3(-0.15, -0.05, -0.15);
    ringParticles.direction2 = new BABYLON.Vector3(0.15, 0.05, 0.15);
    ringParticles.minEmitPower = 0.1;
    ringParticles.maxEmitPower = 0.2;
    ringParticles.updateSpeed = 0.01;
    ringParticles.start();

    let time = 0;
    scene.registerBeforeRender(() => {
      time += 0.003;
      earth.rotation.y += 0.003;
      atmo.rotation.y += 0.003;
      ring.rotation.y += 0.0015;
      ring.rotation.x = 1.2 + Math.sin(time * 0.2) * 0.05;
    });

    engine.runRenderLoop(() => scene.render());

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="main-menu">
      <div className="menu-canvas-container">
        <canvas ref={canvasRef} />
      </div>
      <div className="menu-overlay">
        <div className="menu-content fade-in">
          <h1 className="menu-title">ASTRAL<span>IS</span></h1>
          <p className="menu-subtitle">Space Flight Simulator</p>
          <div className="menu-actions">
            <button className="btn btn-primary" onClick={() => onNavigate('flight')}>
              Launch Mission
            </button>
            <button className="btn" onClick={() => onNavigate('vab')}>
              Vehicle Assembly
            </button>
          </div>
          <div className="destinations">
            {DESTINATIONS.map((d) => (
              <div key={d.id} className="dest-card glass-sm">
                <div className={`dest-planet ${d.planetClass}`} />
                <div className="dest-name">{d.name}</div>
                <div className="dest-detail">{d.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
