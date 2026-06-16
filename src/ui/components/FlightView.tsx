import React, { useEffect, useRef, useCallback, useState } from 'react';
import { CelestiaGame } from '../../core/game';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Particles/particleSystem';

interface FlightViewProps {
  game: CelestiaGame;
}

interface MapData {
  show: boolean;
  zoom: number;
  targetBody: string;
}

const FlightView: React.FC<FlightViewProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const [mapView, setMapView] = useState(false);
  const cameraRef = useRef<BABYLON.UniversalCamera | null>(null);
  const mapCameraRef = useRef<BABYLON.ArcRotateCamera | null>(null);
  const starLayersRef = useRef<BABYLON.Mesh[]>([]);
  const rocketRef = useRef<BABYLON.Mesh | null>(null);
  const exhaustSysRef = useRef<BABYLON.ParticleSystem | null>(null);
  const smokeSysRef = useRef<BABYLON.ParticleSystem | null>(null);
  const trajectoryLinesRef = useRef<BABYLON.LinesMesh[]>([]);
  const bodyMeshesRef = useRef<Map<string, BABYLON.Mesh>>(new Map());
  const atmosphereRef = useRef<BABYLON.Mesh | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      disableWebGL2Support: false,
    });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    engineRef.current = engine;
    sceneRef.current = scene;

    const camera = new BABYLON.UniversalCamera(
      'mainCam',
      new BABYLON.Vector3(0, 0, -20000),
      scene
    );
    camera.attachControl(canvas, true);
    camera.inertia = 0.85;
    camera.speed = 5000;
    camera.minZ = 1;
    camera.maxZ = 1e12;
    cameraRef.current = camera;

    const hemisphericLight = new BABYLON.HemisphericLight(
      'hemiLight',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    hemisphericLight.intensity = 0.3;
    hemisphericLight.diffuse = new BABYLON.Color3(0.8, 0.8, 1);
    hemisphericLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.2);

    const sunLight = new BABYLON.DirectionalLight(
      'sunLight',
      new BABYLON.Vector3(1, -0.5, 0),
      scene
    );
    sunLight.intensity = 1.5;

    createStars(scene, camera);
    createNebula(scene);

    const bodies = game.getCelestialBodies();
    bodies.forEach((body) => createCelestialBody(scene, body));
    createOrbitTrajectories(scene, bodies);

    const spacecraft = game.getSpacecraft();
    if (spacecraft) {
      const result = createRocket(scene, spacecraft);
      rocketRef.current = result.rocketGroup as any;
      exhaustSysRef.current = result.exhaust;
      smokeSysRef.current = result.smoke;
    }

    mapCameraRef.current = setupMapCamera(scene, canvas);

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        setMapView((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    engine.runRenderLoop(() => scene.render());

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      scene.dispose();
      engine.dispose();
    };
  }, [game]);

  useEffect(() => {
    if (!sceneRef.current || !cameraRef.current || !mapCameraRef.current) return;
    if (mapView) {
      sceneRef.current.activeCamera = mapCameraRef.current;
    } else {
      sceneRef.current.activeCamera = cameraRef.current;
    }
  }, [mapView]);

  return (
    <div className="flight-view">
      <canvas ref={canvasRef} className="babylon-canvas" />
      {mapView && <div className="map-overlay">MAP VIEW - Press M to toggle</div>}
    </div>
  );
};

function createStars(scene: BABYLON.Scene, camera: BABYLON.UniversalCamera) {
  const layers = [
    { count: 3000, size: 0.5, depth: 1000000, color: new BABYLON.Color4(1, 1, 1, 1), spread: 800000 },
    { count: 1500, size: 1.0, depth: 500000, color: new BABYLON.Color4(0.9, 0.95, 1, 1), spread: 400000 },
    { count: 500, size: 1.8, depth: 200000, color: new BABYLON.Color4(1, 0.95, 0.8, 1), spread: 200000 },
    { count: 200, size: 3.0, depth: 100000, color: new BABYLON.Color4(0.8, 0.9, 1, 1), spread: 100000 },
  ];

  const allStarPositions: BABYLON.Vector3[] = [];

  layers.forEach((layer) => {
    const positions: BABYLON.Vector3[] = [];
    const colors: BABYLON.Color4[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < layer.count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = layer.depth + (Math.random() - 0.5) * layer.spread;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      const pos = new BABYLON.Vector3(x, y, z);
      positions.push(pos);
      allStarPositions.push(pos);

      const twinkle = 0.6 + Math.random() * 0.4;
      colors.push(new BABYLON.Color4(
        layer.color.r * twinkle,
        layer.color.g * twinkle,
        layer.color.b * twinkle,
        0.5 + Math.random() * 0.5
      ));

      sizes.push(layer.size * (0.5 + Math.random()));
    }

    const starMesh = new BABYLON.Mesh(`stars-${layers.indexOf(layer)}`, scene);
    const positionsFlat = positions.flatMap((p) => [p.x, p.y, p.z]);
    const colorsFlat = colors.flatMap((c) => [c.r, c.g, c.b, c.a]);

    const vertexData = new BABYLON.VertexData();
    const indices: number[] = [];
    const vertPositions: number[] = [];
    const vertColors: number[] = [];

    positions.forEach((pos, idx) => {
      const s = sizes[idx] || layer.size;
      const half = s / 2;
      const idxStart = vertPositions.length / 3;

      vertPositions.push(
        pos.x - half, pos.y - half, pos.z,
        pos.x + half, pos.y - half, pos.z,
        pos.x + half, pos.y + half, pos.z,
        pos.x - half, pos.y + half, pos.z,
      );

      const c = colors[idx];
      for (let v = 0; v < 4; v++) {
        vertColors.push(c.r, c.g, c.b, c.a);
      }

      indices.push(
        idxStart, idxStart + 1, idxStart + 2,
        idxStart, idxStart + 2, idxStart + 3,
      );
    });

    vertexData.positions = vertPositions;
    vertexData.colors = vertColors;
    vertexData.indices = indices;
    vertexData.applyToMesh(starMesh);

    const mat = new BABYLON.StandardMaterial(`starMat-${layers.indexOf(layer)}`, scene);
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    starMesh.material = mat;
    starMesh.isPickable = false;
    starMesh.freezeWorldMatrix();

    scene.registerBeforeRender(() => {
      const camPos = camera.position;
      starMesh.position.x = camPos.x * 0.02 * (layers.indexOf(layer) + 1);
      starMesh.position.y = camPos.y * 0.02 * (layers.indexOf(layer) + 1);
      starMesh.position.z = camPos.z * 0.02 * (layers.indexOf(layer) + 1);
    });
  });
}

function createNebula(scene: BABYLON.Scene) {
  const colors = [
    new BABYLON.Color4(0.6, 0.2, 0.5, 0.03),
    new BABYLON.Color4(0.2, 0.3, 0.6, 0.02),
    new BABYLON.Color4(0.8, 0.3, 0.1, 0.015),
    new BABYLON.Color4(0.1, 0.5, 0.5, 0.025),
  ];

  colors.forEach((color, idx) => {
    const cloudCount = 30;
    for (let i = 0; i < cloudCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const dist = 300000 + Math.random() * 400000;

      const cloud = BABYLON.MeshBuilder.CreateSphere(
        `nebula-${idx}-${i}`,
        { diameter: 5000 + Math.random() * 30000, segments: 4 },
        scene
      );

      cloud.position.x = dist * Math.sin(phi) * Math.cos(theta);
      cloud.position.y = dist * Math.sin(phi) * Math.sin(theta);
      cloud.position.z = dist * Math.cos(phi);

      const mat = new BABYLON.StandardMaterial(`nebMat-${idx}-${i}`, scene);
      mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
      mat.alpha = color.a * (0.3 + Math.random() * 0.7);
      mat.emissiveColor = new BABYLON.Color3(color.r * 0.5, color.g * 0.5, color.b * 0.5);
      mat.backFaceCulling = false;
      mat.disableLighting = true;
      cloud.material = mat;
      cloud.isPickable = false;
    }
  });
}

function createOrbitTrajectories(scene: BABYLON.Scene, bodies: any[]) {
  bodies.forEach((body) => {
    if (!body.position || body.id === 'sun') return;

    const dist = Math.sqrt(
      body.position.x ** 2 + body.position.y ** 2 + body.position.z ** 2
    ) / 50000;

    const points: BABYLON.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new BABYLON.Vector3(
        Math.cos(angle) * dist,
        0,
        Math.sin(angle) * dist
      ));
    }

    const orbit = BABYLON.MeshBuilder.CreateLines(
      `orbit-${body.id}`,
      { points },
      scene
    );
    orbit.color = new BABYLON.Color3(0, 0.6, 0.3);
    orbit.alpha = 0.2;
  });
}

function createCelestialBody(scene: BABYLON.Scene, body: any) {
  const radius = Math.max(100, body.radius / 50000);

  if (body.id === 'earth') {
    createEarth(scene, body, radius);
  } else if (body.id === 'moon') {
    createMoon(scene, body, radius);
  } else if (body.id === 'mars') {
    createMars(scene, body, radius);
  } else if (body.id === 'sun') {
    createSun(scene, body, radius);
  } else {
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      body.id,
      { diameter: radius * 2, segments: 48 },
      scene
    );
    const mat = new BABYLON.PBRMetallicRoughnessMaterial(`${body.id}-mat`, scene);
    mat.baseColor = body.id === 'venus' ? new BABYLON.Color3(0.83, 0.63, 0.19) :
                    body.id === 'mercury' ? new BABYLON.Color3(0.55, 0.55, 0.55) :
                    new BABYLON.Color3(0.7, 0.7, 0.7);
    mat.metallic = 0.1;
    mat.roughness = 0.9;
    sphere.material = mat;

    if (body.position) {
      sphere.position.x = body.position.x / 50000;
      sphere.position.y = body.position.y / 50000;
      sphere.position.z = body.position.z / 50000;
    }
    sphere.setEnabled(false);
  }
}

function createEarth(scene: BABYLON.Scene, body: any, radius: number) {
  const earth = BABYLON.MeshBuilder.CreateSphere(
    'earth',
    { diameter: radius * 2, segments: 96 },
    scene
  );

  const mat = new BABYLON.PBRMetallicRoughnessMaterial('earth-mat', scene);
  mat.baseColor = new BABYLON.Color3(0.15, 0.4, 0.8);
  mat.metallic = 0.0;
  mat.roughness = 0.6;
  mat.subSurface.isTranslucencyEnabled = true;
  mat.subSurface.translucencyIntensity = 0.3;

  const detailMaterial = new BABYLON.StandardMaterial('earth-detail', scene);
  detailMaterial.diffuseColor = new BABYLON.Color3(0.15, 0.4, 0.8);
  detailMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  detailMaterial.specularPower = 32;

  const landColor = new BABYLON.Color3(0.2, 0.5, 0.15);
  const oceanColor = new BABYLON.Color3(0.1, 0.3, 0.7);

  const vertexCount = (96 + 1) * (96 + 1);
  const positions = earth.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const colors: number[] = [];

  if (positions) {
    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const nx = x / radius;
      const ny = y / radius;
      const nz = z / radius;

      const noise = Math.sin(nx * 12.3 + ny * 7.8) * Math.cos(ny * 9.1 + nz * 5.4) +
                    Math.sin(nz * 6.7 + nx * 4.2) * 0.5 +
                    Math.cos(nx * 3.1 + ny * 8.9 + nz * 2.3) * 0.3;

      const isLand = noise > 0.3;

      if (isLand) {
        const elevation = (noise - 0.3) / 0.7;
        const r = landColor.r + elevation * 0.15;
        const g = landColor.g + elevation * 0.1;
        const b = landColor.b - elevation * 0.05;
        colors.push(r, g, b, 1);
      } else {
        const depth = Math.abs(noise) / 0.3;
        const r = oceanColor.r - depth * 0.05;
        const g = oceanColor.g - depth * 0.1;
        const b = oceanColor.b + depth * 0.1;
        colors.push(r, g, b, 1);
      }
    }

    earth.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
  }

  detailMaterial.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.1);
  earth.material = detailMaterial;

  earth.rotation.x = 0.41;
  earth.rotation.z = 0.12;

  const atmoMesh = BABYLON.MeshBuilder.CreateSphere(
    'earth-atmo',
    { diameter: radius * 2.05, segments: 48 },
    scene
  );
  const atmoMat = new BABYLON.StandardMaterial('atmo-mat', scene);
  atmoMat.diffuseColor = new BABYLON.Color3(0.3, 0.6, 1);
  atmoMat.alpha = 0.08;
  atmoMat.backFaceCulling = false;
  atmoMat.disableLighting = true;
  atmoMat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.8);
  atmoMesh.material = atmoMat;
  atmoMesh.isPickable = false;

  const cloudMat = new BABYLON.StandardMaterial('cloud-mat', scene);
  cloudMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  cloudMat.alpha = 0.12;
  cloudMat.backFaceCulling = false;
  cloudMat.disableLighting = true;

  const cloudMesh = BABYLON.MeshBuilder.CreateSphere(
    'clouds',
    { diameter: radius * 2.02, segments: 48 },
    scene
  );
  cloudMesh.material = cloudMat;
  cloudMesh.isPickable = false;

  scene.registerBeforeRender(() => {
    earth.rotation.y += 0.001;
    atmoMesh.rotation.y += 0.001;
    cloudMesh.rotation.y += 0.0008;
  });
}

function createMoon(scene: BABYLON.Scene, body: any, radius: number) {
  const moon = BABYLON.MeshBuilder.CreateSphere(
    'moon',
    { diameter: radius * 2, segments: 128 },
    scene
  );

  const mat = new BABYLON.PBRMetallicRoughnessMaterial('moon-mat', scene);
  mat.baseColor = new BABYLON.Color3(0.65, 0.64, 0.6);
  mat.metallic = 0.05;
  mat.roughness = 0.92;
  mat.subSurface.isTranslucencyEnabled = true;
  mat.subSurface.translucencyIntensity = 0.05;

  const vertexCount = moon.getTotalVertices();
  const positions = moon.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const uvs = moon.getVerticesData(BABYLON.VertexBuffer.UVKind);
  const normals: number[] = [];
  const colors: number[] = [];
  const bumpData: number[] = [];

  if (positions) {
    BABYLON.VertexData.ComputeNormals(positions, moon.getIndices()!, normals);

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const nx = x / radius;
      const ny = y / radius;
      const nz = z / radius;

      const craterNoise =
        Math.sin(nx * 5.3 + ny * 3.7) * Math.cos(ny * 4.1 + nz * 6.8) * 0.15 +
        Math.sin(nz * 7.2 + nx * 2.9) * 0.12 +
        Math.cos(nx * 9.7 + ny * 11.3 + nz * 5.1) * 0.08 +
        Math.sin(nx * 15.1 + ny * 13.7) * 0.06 +
        Math.cos(ny * 17.3 + nz * 19.5) * 0.04;

      const crater = Math.abs(craterNoise);
      const displacement = crater * 0.03;

      for (let j = 0; j < 3; j++) {
        positions[i * 3 + j] *= (1 + displacement);
      }

      const brightness = 0.55 + crater * 0.35;
      colors.push(brightness, brightness * 0.97, brightness * 0.92, 1);

      bumpData.push(crater * 0.5);
    }

    moon.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    moon.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    BABYLON.VertexData.ComputeNormals(positions, moon.getIndices()!, normals);
    moon.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  }

  moon.material = mat;

  moon.rotation.x = 0.03;

  const debrisRing = BABYLON.MeshBuilder.CreateTorus(
    'debris-ring',
    { diameter: radius * 2.5, thickness: radius * 0.01, tessellation: 64 },
    scene
  );
  const debrisMat = new BABYLON.StandardMaterial('debris-mat', scene);
  debrisMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
  debrisMat.alpha = 0.05;
  debrisMat.backFaceCulling = false;
  debrisMat.disableLighting = true;
  debrisRing.material = debrisMat;
  debrisRing.rotation.x = Math.PI / 3;
  debrisRing.isPickable = false;

  if (body.position) {
    moon.position.x = body.position.x / 50000;
    moon.position.y = body.position.y / 50000;
    moon.position.z = body.position.z / 50000;
    debrisRing.position.copyFrom(moon.position);
  }
}

function createMars(scene: BABYLON.Scene, body: any, radius: number) {
  const mars = BABYLON.MeshBuilder.CreateSphere(
    'mars',
    { diameter: radius * 2, segments: 64 },
    scene
  );

  const mat = new BABYLON.PBRMetallicRoughnessMaterial('mars-mat', scene);
  mat.baseColor = new BABYLON.Color3(0.76, 0.27, 0.05);
  mat.metallic = 0.1;
  mat.roughness = 0.85;

  const positions = mars.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  if (positions) {
    const colors: number[] = [];
    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const nx = x / radius;
      const ny = y / radius;

      const noise = Math.sin(nx * 8.1 + ny * 5.3) * Math.cos(ny * 6.7) * 0.2 +
                    Math.sin(ny * 11.2 + nx * 7.4) * 0.1;
      const r = 0.76 + noise * 0.15;
      const g = 0.27 + noise * 0.1;
      const b = 0.05 + noise * 0.03;
      colors.push(Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b)), 1);
    }
    mars.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
  }

  mars.material = mat;

  if (body.position) {
    mars.position.x = body.position.x / 50000;
    mars.position.y = body.position.y / 50000;
    mars.position.z = body.position.z / 50000;
  }
}

function createSun(scene: BABYLON.Scene, body: any, radius: number) {
  const sun = BABYLON.MeshBuilder.CreateSphere(
    'sun',
    { diameter: radius * 2, segments: 32 },
    scene
  );

  const mat = new BABYLON.StandardMaterial('sun-mat', scene);
  mat.diffuseColor = new BABYLON.Color3(1, 0.9, 0.5);
  mat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
  mat.disableLighting = true;
  sun.material = mat;

  const glow = BABYLON.MeshBuilder.CreateSphere(
    'sun-glow',
    { diameter: radius * 6, segments: 16 },
    scene
  );
  const glowMat = new BABYLON.StandardMaterial('sun-glow-mat', scene);
  glowMat.diffuseColor = new BABYLON.Color3(1, 0.7, 0.2);
  glowMat.alpha = 0.08;
  glowMat.backFaceCulling = false;
  glowMat.disableLighting = true;
  glowMat.emissiveColor = new BABYLON.Color3(0.5, 0.3, 0.1);
  glow.material = glowMat;
  glow.isPickable = false;

  if (body.position) {
    sun.position.x = body.position.x / 50000;
    sun.position.y = body.position.y / 50000;
    sun.position.z = body.position.z / 50000;
    glow.position.copyFrom(sun.position);
  }

  scene.registerBeforeRender(() => {
    sun.rotation.y += 0.0005;
  });
}

function createRocket(scene: BABYLON.Scene, spacecraft: any): {
  rocketGroup: BABYLON.TransformNode;
  exhaust: BABYLON.ParticleSystem;
  smoke: BABYLON.ParticleSystem;
} {
  const rocketGroup = new BABYLON.TransformNode('rocket');

  let totalHeight = 0;
  spacecraft.stages.forEach((stage: any, stageIdx: number) => {
    const stageHeight = stage.parts.reduce((h: number, p: any) =>
      h + (p.dimensions?.y || 2), 0);

    const body = BABYLON.MeshBuilder.CreateCylinder(
      `stage-body-${stageIdx}`,
      { height: stageHeight, diameter: 2, tessellation: 16 },
      scene
    );
    body.parent = rocketGroup;
    body.position.y = -totalHeight - stageHeight / 2;

    const bodyMat = new BABYLON.PBRMetallicRoughnessMaterial(
      `bodyMat-${stageIdx}`, scene
    );
    bodyMat.baseColor = new BABYLON.Color3(0.7, 0.72, 0.75);
    bodyMat.metallic = 0.7;
    bodyMat.roughness = 0.3;

    const topBand = BABYLON.MeshBuilder.CreateCylinder(
      `band-top-${stageIdx}`,
      { height: 0.15, diameter: 2.15, tessellation: 16 },
      scene
    );
    topBand.parent = rocketGroup;
    topBand.position.y = -totalHeight;
    const bandMat = new BABYLON.PBRMetallicRoughnessMaterial(
      `bandMat-${stageIdx}`, scene
    );
    bandMat.baseColor = new BABYLON.Color3(0.3, 0.3, 0.32);
    bandMat.metallic = 0.8;
    bandMat.roughness = 0.2;

    if (stage.parts.some((p: any) => p.type === 'engine')) {
      const engineBell = BABYLON.MeshBuilder.CreateCylinder(
        `engine-${stageIdx}`,
        { height: 1.2, diameterTop: 1.2, diameterBottom: 2.0, tessellation: 16 },
        scene
      );
      engineBell.parent = rocketGroup;
      engineBell.position.y = -totalHeight - stageHeight - 0.6;

      const engineMat = new BABYLON.PBRMetallicRoughnessMaterial(
        `engineMat-${stageIdx}`, scene
      );
      engineMat.baseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      engineMat.metallic = 0.9;
      engineMat.roughness = 0.2;
      engineBell.material = engineMat;

      const nozzle = BABYLON.MeshBuilder.CreateCylinder(
        `nozzle-${stageIdx}`,
        { height: 0.6, diameterTop: 1.8, diameterBottom: 1.4, tessellation: 16 },
        scene
      );
      nozzle.parent = rocketGroup;
      nozzle.position.y = -totalHeight - stageHeight - 1.2;
      const nozzleMat = new BABYLON.PBRMetallicRoughnessMaterial(
        `nozzleMat-${stageIdx}`, scene
      );
      nozzleMat.baseColor = new BABYLON.Color3(0.15, 0.12, 0.1);
      nozzleMat.metallic = 0.95;
      nozzleMat.roughness = 0.15;
      nozzle.material = nozzleMat;
    }

    totalHeight += stageHeight + 0.5;
    body.material = bodyMat;
  });

  const noseCone = BABYLON.MeshBuilder.CreateCylinder(
    'nosecone',
    { height: 2.5, diameterTop: 0.05, diameterBottom: 2.0, tessellation: 16 },
    scene
  );
  noseCone.parent = rocketGroup;
  noseCone.position.y = -totalHeight - 1.25;

  const noseMat = new BABYLON.PBRMetallicRoughnessMaterial('noseMat', scene);
  noseMat.baseColor = new BABYLON.Color3(0.9, 0.15, 0.15);
  noseMat.metallic = 0.3;
  noseMat.roughness = 0.4;
  noseCone.material = noseMat;

  rocketGroup.position.y = 6371000 / 50000 + 100;

  if (spacecraft.position) {
    rocketGroup.position.x = spacecraft.position.x / 50000;
    rocketGroup.position.y = spacecraft.position.y / 50000;
    rocketGroup.position.z = spacecraft.position.z / 50000;
  }

  const particleCount = 2000;
  const exhaust = new BABYLON.ParticleSystem('exhaust', particleCount, scene);
  exhaust.emitter = new BABYLON.Vector3(
    rocketGroup.position.x,
    rocketGroup.position.y - 50,
    rocketGroup.position.z
  );
  exhaust.minEmitBox = new BABYLON.Vector3(-1, -1, -1);
  exhaust.maxEmitBox = new BABYLON.Vector3(1, 1, 1);
  exhaust.color1 = new BABYLON.Color4(1, 0.8, 0.4, 0.8);
  exhaust.color2 = new BABYLON.Color4(1, 0.5, 0.1, 0.6);
  exhaust.colorDead = new BABYLON.Color4(0.3, 0.1, 0.05, 0);
  exhaust.minSize = 1;
  exhaust.maxSize = 5;
  exhaust.minLifeTime = 0.3;
  exhaust.maxLifeTime = 0.8;
  exhaust.emitRate = 300;
  exhaust.createSphereEmitter(3);
  exhaust.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
  exhaust.gravity = new BABYLON.Vector3(0, -5, 0);
  exhaust.direction1 = new BABYLON.Vector3(-1, -1, -1);
  exhaust.direction2 = new BABYLON.Vector3(1, 1, 1);
  exhaust.minEmitPower = 20;
  exhaust.maxEmitPower = 50;
  exhaust.updateSpeed = 0.01;
  exhaust.start();

  const smokeCount = 500;
  const smoke = new BABYLON.ParticleSystem('smoke', smokeCount, scene);
  smoke.emitter = new BABYLON.Vector3(
    rocketGroup.position.x,
    rocketGroup.position.y - 60,
    rocketGroup.position.z
  );
  smoke.minEmitBox = new BABYLON.Vector3(-3, 0, -3);
  smoke.maxEmitBox = new BABYLON.Vector3(3, 0, 3);
  smoke.color1 = new BABYLON.Color4(0.4, 0.4, 0.4, 0.5);
  smoke.color2 = new BABYLON.Color4(0.5, 0.5, 0.5, 0.3);
  smoke.colorDead = new BABYLON.Color4(0.6, 0.6, 0.6, 0);
  smoke.minSize = 5;
  smoke.maxSize = 15;
  smoke.minLifeTime = 2;
  smoke.maxLifeTime = 5;
  smoke.emitRate = 50;
  smoke.createSphereEmitter(5);
  smoke.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
  smoke.gravity = new BABYLON.Vector3(0, -2, 0);
  smoke.direction1 = new BABYLON.Vector3(-2, -0.5, -2);
  smoke.direction2 = new BABYLON.Vector3(2, 0.5, 2);
  smoke.minEmitPower = 5;
  smoke.maxEmitPower = 15;
  smoke.updateSpeed = 0.01;
  smoke.start();

  const rocketNode = rocketGroup;
  const exhaustSys = exhaust;
  const smokeSys = smoke;

  scene.registerBeforeRender(() => {
    const pos = rocketNode.position;
    exhaustSys.emitter = new BABYLON.Vector3(pos.x, pos.y - 50, pos.z);
    smokeSys.emitter = new BABYLON.Vector3(pos.x, pos.y - 60, pos.z);
  });

  return { rocketGroup, exhaust, smoke };
}

function setupMapCamera(scene: BABYLON.Scene, canvas: HTMLCanvasElement): BABYLON.ArcRotateCamera {
  const mapCam = new BABYLON.ArcRotateCamera(
    'mapCam',
    -Math.PI / 2,
    Math.PI / 3,
    1000000,
    BABYLON.Vector3.Zero(),
    scene
  );
  mapCam.lowerRadiusLimit = 10000;
  mapCam.upperRadiusLimit = 1e10;
  mapCam.minZ = 1;
  mapCam.maxZ = 1e12;
  mapCam.panningSensibility = 0.5;
  mapCam.attachControl(canvas, true);
  mapCam.setEnabled(false);

  const gridMat = new BABYLON.StandardMaterial('grid-mat', scene);
  gridMat.diffuseColor = new BABYLON.Color3(0, 0.3, 0.1);
  gridMat.alpha = 0.3;
  gridMat.wireframe = true;
  gridMat.disableLighting = true;

  return mapCam;
}

export default FlightView;
