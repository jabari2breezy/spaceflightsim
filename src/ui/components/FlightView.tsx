/**
 * Flight View Component - Main 3D visualization
 */

import React, { useEffect, useRef } from 'react';
import { CelestiaGame } from '../../core/game';
import * as BABYLON from '@babylonjs/core';

interface FlightViewProps {
  game: CelestiaGame;
}

const FlightView: React.FC<FlightViewProps> = ({ game }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create Babylon.js scene
    const engine = new BABYLON.Engine(containerRef.current, true);
    const scene = new BABYLON.Scene(engine);

    engineRef.current = engine;
    sceneRef.current = scene;

    // Camera setup
    const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 0, -50e6), scene);
    camera.attachControl(containerRef.current, true);
    camera.inertia = 0.9;

    // Lighting
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // Create celestial bodies
    const bodies = game.getCelestialBodies();
    
    bodies.forEach((body) => {
      // Scale bodies for visibility
      const scale = Math.log(body.radius) / 1e7;
      const sphere = BABYLON.MeshBuilder.CreateSphere(
        body.id,
        32,
        Math.max(1e6, scale),
        scene
      );

      // Position relative to scene center (Earth at origin for now)
      const scenePos = body.position.x / 1e10; // Scale down for rendering
      sphere.position.x = scenePos;
      sphere.position.y = body.position.y / 1e10;
      sphere.position.z = body.position.z / 1e10;

      // Material
      const material = new BABYLON.StandardMaterial(body.id + '-mat', scene);
      if (body.id === 'earth') {
        material.diffuse = new BABYLON.Color3(0.2, 0.6, 1); // Blue
      } else if (body.id === 'moon') {
        material.diffuse = new BABYLON.Color3(0.8, 0.8, 0.8); // Gray
      } else if (body.id === 'mars') {
        material.diffuse = new BABYLON.Color3(1, 0.5, 0.2); // Red
      } else if (body.id === 'sun') {
        material.diffuse = new BABYLON.Color3(1, 1, 0); // Yellow
        material.emissiveColor = new BABYLON.Color3(1, 1, 0);
      } else {
        material.diffuse = new BABYLON.Color3(0.7, 0.7, 0.7);
      }

      sphere.material = material;
    });

    // Draw spacecraft
    const spacecraft = game.getSpacecraft();
    if (spacecraft) {
      const spacecraftMesh = BABYLON.MeshBuilder.CreateBox(
        'spacecraft',
        { size: 5 },
        scene
      );

      const material = new BABYLON.StandardMaterial('spacecraft-mat', scene);
      material.diffuse = new BABYLON.Color3(1, 0, 0);
      spacecraftMesh.material = material;

      // Position spacecraft
      const scPos = spacecraft.position.x / 1e10;
      spacecraftMesh.position.x = scPos;
      spacecraftMesh.position.y = spacecraft.position.y / 1e10;
      spacecraftMesh.position.z = spacecraft.position.z / 1e10;

      // Update spacecraft position each frame
      scene.registerBeforeRender(() => {
        const updatedSpacecraft = game.getSpacecraft();
        if (updatedSpacecraft) {
          spacecraftMesh.position.x = updatedSpacecraft.position.x / 1e10;
          spacecraftMesh.position.y = updatedSpacecraft.position.y / 1e10;
          spacecraftMesh.position.z = updatedSpacecraft.position.z / 1e10;
        }
      });
    }

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, [game]);

  return (
    <div className="flight-view">
      <div ref={containerRef} className="babylon-container" />
    </div>
  );
};

export default FlightView;
