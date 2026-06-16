import React, { useEffect, useRef } from 'react';
import { Spacecraft } from '../../types';
import * as BABYLON from '@babylonjs/core';

interface SpacecraftPreviewProps {
  spacecraft: Spacecraft;
}

const SpacecraftPreview: React.FC<SpacecraftPreviewProps> = ({ spacecraft }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.05, 0.05, 0.1, 1);

    const camera = new BABYLON.ArcRotateCamera(
      'cam',
      Math.PI / 2,
      Math.PI / 2.5,
      15,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 50;

    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.intensity = 0.6;
    hemi.diffuse = new BABYLON.Color3(0.8, 0.8, 1);

    const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(1, -0.5, 0), scene);
    dir.intensity = 0.8;

    let yOffset = 0;
    spacecraft.stages.forEach((stage, idx) => {
      const stageHeight = Math.max(2, stage.parts.length * 2);

      const body = BABYLON.MeshBuilder.CreateCylinder(
        `preview-stage-${idx}`,
        { height: stageHeight, diameter: 2, tessellation: 16 },
        scene
      );
      body.position.y = -yOffset - stageHeight / 2;

      const mat = new BABYLON.PBRMetallicRoughnessMaterial(`preview-mat-${idx}`, scene);
      const t = idx / Math.max(1, spacecraft.stages.length);
      mat.baseColor = new BABYLON.Color3(0.3 + t * 0.4, 0.5, 0.8 - t * 0.5);
      mat.metallic = 0.6;
      mat.roughness = 0.3;
      body.material = mat;

      yOffset += stageHeight + 0.3;
    });

    const nose = BABYLON.MeshBuilder.CreateCylinder(
      'preview-nose',
      { height: 2, diameterTop: 0.05, diameterBottom: 2, tessellation: 16 },
      scene
    );
    nose.position.y = -yOffset - 1;
    const noseMat = new BABYLON.PBRMetallicRoughnessMaterial('preview-nose-mat', scene);
    noseMat.baseColor = new BABYLON.Color3(0.9, 0.15, 0.15);
    noseMat.metallic = 0.3;
    noseMat.roughness = 0.4;
    nose.material = noseMat;

    engine.runRenderLoop(() => scene.render());

    const handleResize = () => engine.resize();
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
      <canvas ref={canvasRef} className="preview-canvas" />
    </div>
  );
};

export default SpacecraftPreview;
