/**
 * Spacecraft Preview Component
 */

import React, { useEffect, useRef } from 'react';
import { Spacecraft } from '../../types';
import * as BABYLON from '@babylonjs/core';

interface SpacecraftPreviewProps {
  spacecraft: Spacecraft;
}

const SpacecraftPreview: React.FC<SpacecraftPreviewProps> = ({ spacecraft }) => {
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

    // Camera
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 2.5,
      50,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(containerRef.current, true);

    // Lighting
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    const pointLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(10, 10, 10), scene);
    pointLight.intensity = 0.5;

    // Draw spacecraft stages
    let yOffset = 0;
    spacecraft.stages.forEach((stage, stageIdx) => {
      const stageHeight = 2;
      const box = BABYLON.MeshBuilder.CreateBox(
        `stage-${stageIdx}`,
        { height: stageHeight, width: 1, depth: 1 },
        scene
      );
      box.position.y = yOffset;

      // Color by stage
      const material = new BABYLON.StandardMaterial(`mat-${stageIdx}`, scene);
      material.diffuse = new BABYLON.Color3(
        stageIdx / spacecraft.stages.length,
        0.5,
        1 - stageIdx / spacecraft.stages.length
      );
      box.material = material;

      yOffset += stageHeight + 0.5;
    });

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
  }, [spacecraft]);

  return (
    <div className="spacecraft-preview">
      <h3>Vehicle Preview</h3>
      <div ref={containerRef} className="preview-container" />
    </div>
  );
};

export default SpacecraftPreview;
