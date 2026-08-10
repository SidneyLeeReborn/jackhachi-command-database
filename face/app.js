import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const stage = document.querySelector('#face-stage');
const canvas = document.querySelector('#face-canvas');
const loading = document.querySelector('#loading');
const resetButton = document.querySelector('#reset');
const smokeLayer = document.querySelector('#smoke-layer');
const duragButton = document.querySelector('#durag-toggle');
const bandanaButton = document.querySelector('#bandana-toggle');
const jointButton = document.querySelector('#joint-toggle');
const paintToggle = document.querySelector('#paint-toggle');
const paintOptions = document.querySelector('#paint-options');
const paintColour = document.querySelector('#paint-colour');
const paintColourSwatch = document.querySelector('#paint-colour-swatch');
const paintSize = document.querySelector('#paint-size');
const paintSizeValue = document.querySelector('#paint-size-value');
const paintHardness = document.querySelector('#paint-hardness');
const paintHardnessValue = document.querySelector('#paint-hardness-value');
const paintOpacity = document.querySelector('#paint-opacity');
const paintOpacityValue = document.querySelector('#paint-opacity-value');
const paintEraser = document.querySelector('#paint-eraser');
const paintUndo = document.querySelector('#paint-undo');
const paintRedo = document.querySelector('#paint-redo');
const paintClear = document.querySelector('#paint-clear');
const paintCursor = document.querySelector('#paint-cursor');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();
const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
camera.position.set(0, 0.05, 4.4);

scene.add(new THREE.HemisphereLight(0xb8c9ff, 0x3d1230, 2.15));
const keyLight = new THREE.DirectionalLight(0xffe3cc, 4.2);
keyLight.position.set(2.8, 4.5, 5);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x535cff, 3.2);
rimLight.position.set(-4, 1, -2);
scene.add(rimLight);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const planeHit = new THREE.Vector3();
const startWorld = new THREE.Vector3();
const currentWorld = new THREE.Vector3();
const startLocal = new THREE.Vector3();
const currentLocal = new THREE.Vector3();
const localDelta = new THREE.Vector3();
const inverseWorld = new THREE.Matrix4();
const tempVertex = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
const surfacePointWorld = new THREE.Vector3();
const normalMatrix = new THREE.Matrix3();
const cameraDirection = new THREE.Vector3();
const jointSnapOffset = new THREE.Vector3();
const jointTipWorld = new THREE.Vector3();
const projectedTip = new THREE.Vector3();
const eyeLook = new THREE.Vector2();
const eyeLookTarget = new THREE.Vector2();
const effectiveEyeLookTarget = new THREE.Vector2();
const pupils = [];
const jointTransform = new TransformControls(camera, canvas);
jointTransform.setMode('rotate');
jointTransform.setSpace('local');
jointTransform.setSize(0.44);
jointTransform.enabled = true;
scene.add(jointTransform.getHelper());
// TransformControls includes enormous axis guide lines. Keep only the compact rings.
jointTransform._gizmo?.helper?.rotate?.clear();

let head = null;
let modelPivot = null;
let positions = null;
let rest = null;
let offsets = null;
let velocities = null;
let active = [];
let weights = [];
let dragging = false;
let dragMode = null;
let activePointer = null;
let lastMoveTime = performance.now();
let lastDesired = new THREE.Vector3();
let jointRoot = null;
let jointVisual = null;
let jointInhaleVisual = null;
let jointInhaleMaterials = [];
let jointTip = null;
let jointContact = null;
let jointSnapped = false;
let jointSnappedAt = 0;
let jointAnchorIndex = null;
let jointDragOffset = new THREE.Vector3();
let nextSmokeAt = 0;
let nextNoseExhaleAt = 0;
let noseExhaleUntil = 0;
let nextNosePuffAt = 0;
let smokedFraction = 0;
let jointSpitting = false;
let jointSpitAt = 0;
let jointDropping = false;
let jointDropVelocity = 0;
let jointDropBounces = 0;
const jointSpitVelocity = new THREE.Vector3();
let alteredFace = null;
let alteredFaceOpacity = 0;
let smileAmount = 0;
let lastSmileAmount = 0;
let smileVertices = [];
let stonerVertices = [];
let blinkVertices = [];
let combinedDeformationVertices = [];
let lastBlinkAmount = 0;
let turnAngle = 0;
let headPitch = 0;
let duragRoot = null;
let duragEquipped = false;
let bandanaRoot = null;
let bandanaEquipped = false;
let paintLayer = null;
let paintTexture = null;
let paintContext = null;
let paintBaseContext = null;
let paintStrokeContext = null;
let paintMode = false;
let paintEraseMode = false;
let previousPaintPoint = null;
let activePaintErase = false;
let activePaintOpacity = 1;
let paintDirtyBounds = null;
let paintTextureUpdateQueued = false;
let paintStampKey = '';
let paintHistory = [];
let paintRedoHistory = [];
let paintHasContent = false;
const smokePool = [];
const paintBaseCanvas = document.createElement('canvas');
const paintStrokeCanvas = document.createElement('canvas');
const paintStampCanvas = document.createElement('canvas');
const paintStampContext = paintStampCanvas.getContext('2d');
let idleTime = 0;
let entranceTime = 0;
let fullFaceRecoveryAt = 0;
let groanContext = null;
let groanBuffer = null;
let groanOriginalBuffer = null;
let groanSource = null;
let groanIntroSource = null;
let groanTailSource = null;
let groanSustainGain = null;
let groanMasterGain = null;
let groanTimer = null;
let faceDragStartedAt = 0;
let groanLoopStart = 0.25;
let groanLoopEnd = 0.68;
let nextBlinkAt = performance.now() + 10000;
let blinkStartedAt = -Infinity;
let nextIdleStateAt = performance.now() + 9000;
let idleState = -1;
let idleStateStartedAt = 0;
let idleStateUntil = 0;
let motionSensorsInstalled = false;
let motionPermissionRequested = false;
let motionReferenceBeta = null;
let motionReferenceGamma = null;
let motionPreviousBeta = null;
let motionPreviousGamma = null;
let lastOrientationMovementAt = 0;
let motionTargetYaw = 0;
let motionTargetPitch = 0;
let motionTargetRoll = 0;
let motionYaw = 0;
let motionPitch = 0;
let motionRoll = 0;
const motionLookTarget = new THREE.Vector2();
const motionLook = new THREE.Vector2();
const motionKick = new THREE.Vector3();
const motionKickVelocity = new THREE.Vector3();
let lastMotionKickAt = 0;

const GRAB_RADIUS = 0.34;
const MAX_PULL = 1.18;
const SPRING = 54;
const DAMPING = 5.8;
const JOINT_SCALE = 7;
const JOINT_LOOSE_POSITION = new THREE.Vector3(-0.56, -0.43, 0.92);
const JOINT_LIP_CENTER = new THREE.Vector3(0, -0.53, 0.44);
const JOINT_MOUTH_ANCHOR = JOINT_LIP_CENTER.clone();
const JOINT_LIP_RADIUS_X = 0.30;
const JOINT_LIP_RADIUS_Y = 0.13;
const JOINT_LIP_CAPTURE_X = 0.42;
const JOINT_LIP_CAPTURE_Y = 0.23;
const jointRestRotation = new THREE.Euler(0, 0, THREE.MathUtils.degToRad(-8));
const jointContactFromRoot = new THREE.Vector3();
const ALTERED_FACE_DELAY = 4000;
const ALTERED_FACE_FADE_IN = 60000;
const ALTERED_FACE_FADE_OUT = 3000;
const SMILE_FADE_IN = 60000;
const SMILE_FADE_OUT = 4000;
const JOINT_SMOKE_DURATION = 210000;
const JOINT_FULL_LENGTH = 0.0786;
const JOINT_CONTACT_X = -0.0393;
const JOINT_MIN_SCALE_X = 0.08;
const INHALE_CYCLE = 8000;
const GROAN_DRAG_DELAY = 500;
const GROAN_CHANCE = 0.18;
const PAINT_TEXTURE_SIZE = 1024;
const PAINT_SIZE_SCALE = PAINT_TEXTURE_SIZE / 2048;
const PAINT_HISTORY_LIMIT = 2;
const MOTION_TILT_LIMIT = THREE.MathUtils.degToRad(7);
const MOTION_PITCH_LIMIT = THREE.MathUtils.degToRad(5);
const MOTION_DEAD_ZONE = 5;
const MOTION_SETTLE_DELAY = 900;

// Mouse placement should feel physical without demanding pixel-perfect contact.
// This is measured from the joint's mouth end to the nearest head vertex.
const EYE_SPECS = [
  { x: -0.196, y: 0.721, z: 0.395, offsetX: 0.043, offsetY: -0.021, offsetZ: 0.038, size: 1 },
  { x: 0.186, y: 0.723, z: 0.418, offsetX: -0.005, offsetY: -0.012, offsetZ: 0.007, size: 1 }
];

const CLASSIC_PAINT_COLOURS = [
  '#000000', '#7f7f7f', '#c3c3c3', '#ffffff', '#7f0000', '#ff0000', '#7f7f00', '#ffff00',
  '#007f00', '#00ff00', '#007f7f', '#00ffff', '#00007f', '#0000ff', '#7f007f', '#ff00ff',
  '#7f3f00', '#ff7f00', '#3f7f00', '#7fff00', '#007f3f', '#00ff7f', '#003f7f', '#007fff',
  '#3f007f', '#7f00ff', '#7f003f', '#ff007f', '#7f3f3f', '#ff7f7f', '#3f7f7f', '#7fffff'
];

new GLTFLoader().load(
  './jackhachi-head.glb?v=original-shell-2',
  (gltf) => {
    const modelMeshes = [];
    gltf.scene.traverse((object) => {
      if (object.isMesh) modelMeshes.push(object);
    });
    head = modelMeshes.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    if (!head) throw new Error('No Jackhachi mesh found.');

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    modelPivot = new THREE.Group();
    modelPivot.add(gltf.scene);
    scene.add(modelPivot);

    head.geometry = head.geometry.toNonIndexed();
    head.geometry.computeVertexNormals();
    positions = head.geometry.attributes.position;
    rest = new Float32Array(positions.array);
    offsets = new Float32Array(rest.length);
    velocities = new Float32Array(rest.length);
    head.frustumCulled = false;

    modelPivot.updateMatrixWorld(true);
    buildSmileMap();
    buildStonerMap();
    buildBlinkMap();
    buildCombinedDeformationMap();
    setupPaintLayer();

    Promise.all([
      textureLoader.loadAsync('./shaded2.webp?v=optimized-1'),
      textureLoader.loadAsync('./shaded3.webp?v=optimized-1')
    ]).then(([normalTexture, alteredTexture]) => {
      for (const texture of [normalTexture, alteredTexture]) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }

      const materials = Array.isArray(head.material) ? head.material : [head.material];
      for (const material of materials) {
        material.map = normalTexture;
        // Keep the sculpt readable without the wet/plastic showroom gloss.
        if ('roughness' in material) material.roughness = 0.78;
        if ('metalness' in material) material.metalness = 0;
        if ('envMapIntensity' in material) material.envMapIntensity = 0.38;
        if ('clearcoat' in material) material.clearcoat = 0;
        if ('specularIntensity' in material) material.specularIntensity = 0.42;
        material.needsUpdate = true;
      }

      alteredFace = head.clone(false);
      alteredFace.name = 'ALTERED_JACKHACHI_TEXTURE';
      alteredFace.geometry = head.geometry;
      alteredFace.material = materials.map((source) => {
        const material = source.clone();
        material.map = alteredTexture;
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
        material.depthFunc = THREE.EqualDepth;
        material.polygonOffset = false;
        material.needsUpdate = true;
        return material;
      });
      if (!Array.isArray(head.material)) alteredFace.material = alteredFace.material[0];
      alteredFace.position.copy(head.position);
      alteredFace.rotation.copy(head.rotation);
      alteredFace.scale.copy(head.scale);
      alteredFace.renderOrder = head.renderOrder + 1;
      alteredFace.frustumCulled = false;
      alteredFace.visible = false;
      head.parent.add(alteredFace);

      addTrackingEyes();
    }).catch((error) => console.error('Texture load failure', error));

    loading.remove();
    resize();
  },
  undefined,
  (error) => {
    loading.textContent = 'FACE LOAD FAILURE. PRESS F5.';
    console.error(error);
  }
);

new GLTFLoader().load(
  './fat-joint.glb?v=1',
  (gltf) => {
    jointRoot = new THREE.Group();
    jointRoot.name = 'DRAGGABLE_FAT_JOINT';
    jointVisual = gltf.scene;
    jointRoot.add(jointVisual);
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.renderOrder = 100;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.depthTest = false;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    });
    jointRoot.scale.setScalar(JOINT_SCALE);
    jointRoot.position.copy(JOINT_LOOSE_POSITION);
    jointRoot.rotation.copy(jointRestRotation);
    jointRoot.visible = false;
    scene.add(jointRoot);
    jointButton.disabled = false;

    jointTip = new THREE.Object3D();
    jointTip.position.set(0.0393, 0, 0);
    jointRoot.add(jointTip);

    jointContact = new THREE.Object3D();
    jointContact.position.set(JOINT_CONTACT_X, 0, 0);
    jointRoot.add(jointContact);

    textureLoader.loadAsync('./joint-inhale.png?v=1').then((inhaleTexture) => {
      inhaleTexture.colorSpace = THREE.SRGBColorSpace;
      inhaleTexture.flipY = false;
      inhaleTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      jointInhaleVisual = gltf.scene.clone(true);
      jointInhaleVisual.name = 'JOINT_INHALE_TEXTURE_OVERLAY';
      jointInhaleVisual.visible = false;
      jointInhaleMaterials = [];
      jointInhaleVisual.traverse((object) => {
        if (!object.isMesh) return;
        object.renderOrder = 101;
        const sources = Array.isArray(object.material) ? object.material : [object.material];
        const replacements = sources.map((source) => {
          const material = source.clone();
          material.map = inhaleTexture;
          material.transparent = true;
          material.opacity = 0;
          material.depthTest = false;
          material.depthWrite = false;
          material.needsUpdate = true;
          jointInhaleMaterials.push(material);
          return material;
        });
        object.material = Array.isArray(object.material) ? replacements : replacements[0];
      });
      jointRoot.add(jointInhaleVisual);
    }).catch((error) => console.error('Joint inhale texture failure', error));
  },
  undefined,
  (error) => console.error('Joint load failure', error)
);

new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
  './durag.glb?v=4',
  (gltf) => {
    duragRoot = new THREE.Group();
    duragRoot.name = 'DRAGGABLE_DURAG';
    duragRoot.add(gltf.scene);
    duragRoot.scale.setScalar(1);
    duragRoot.position.set(0, 0, 0);
    duragRoot.rotation.set(0, 0, 0);
    duragRoot.visible = false;
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.renderOrder = 95;
      object.frustumCulled = false;
    });
    scene.add(duragRoot);
    duragButton.disabled = false;
  },
  undefined,
  (error) => console.error('Durag load failure', error)
);

new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
  './sidney-bandana.glb?v=2',
  (gltf) => {
    bandanaRoot = new THREE.Group();
    bandanaRoot.name = 'SIDNEY_BANDANA';
    bandanaRoot.add(gltf.scene);
    bandanaRoot.visible = false;
    gltf.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.renderOrder = 96;
      object.frustumCulled = false;
    });
    scene.add(bandanaRoot);
    bandanaButton.disabled = false;
  },
  undefined,
  (error) => console.error('Sidney bandana load failure', error)
);

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function setupPaintLayer() {
  const paintCanvas = document.createElement('canvas');
  for (const target of [paintCanvas, paintBaseCanvas, paintStrokeCanvas]) {
    target.width = PAINT_TEXTURE_SIZE;
    target.height = PAINT_TEXTURE_SIZE;
  }
  paintContext = paintCanvas.getContext('2d');
  paintBaseContext = paintBaseCanvas.getContext('2d');
  paintStrokeContext = paintStrokeCanvas.getContext('2d');
  paintTexture = new THREE.CanvasTexture(paintCanvas);
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.generateMipmaps = false;
  paintTexture.minFilter = THREE.LinearFilter;
  paintTexture.magFilter = THREE.LinearFilter;

  const paintMaterial = new THREE.MeshBasicMaterial({
    map: paintTexture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  paintLayer = head.clone(false);
  paintLayer.name = 'JACKHACHI_PAINT_LAYER';
  paintLayer.geometry = head.geometry;
  paintLayer.material = paintMaterial;
  paintLayer.position.copy(head.position);
  paintLayer.rotation.copy(head.rotation);
  paintLayer.scale.copy(head.scale);
  paintLayer.renderOrder = head.renderOrder + 2;
  paintLayer.frustumCulled = false;
  paintLayer.visible = false;
  head.parent.add(paintLayer);
  recordPaintState();
}

function updatePaintHistoryButtons() {
  paintUndo.disabled = paintHistory.length <= 1;
  paintRedo.disabled = paintRedoHistory.length === 0;
}

function recordPaintState() {
  if (!paintBaseContext) return;
  paintHistory.push({
    image: paintBaseContext.getImageData(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE),
    hasContent: paintHasContent
  });
  if (paintHistory.length > PAINT_HISTORY_LIMIT) paintHistory.shift();
  paintRedoHistory = [];
  updatePaintHistoryButtons();
}

function restorePaintState(snapshot) {
  if (!snapshot || !paintBaseContext || !paintContext || !paintStrokeContext) return;
  paintBaseContext.putImageData(snapshot.image, 0, 0);
  paintHasContent = snapshot.hasContent;
  if (paintLayer) paintLayer.visible = paintHasContent;
  paintStrokeContext.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE);
  paintContext.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE);
  paintContext.drawImage(paintBaseCanvas, 0, 0);
  paintDirtyBounds = null;
  queuePaintTextureUpdate();
  updatePaintHistoryButtons();
}

function paintBlockerIsCloser(headHit) {
  const blockers = [];
  if (jointRoot?.visible) blockers.push(jointRoot);
  if (duragRoot?.visible) blockers.push(duragRoot);
  if (bandanaRoot?.visible) blockers.push(bandanaRoot);
  for (const eye of pupils) blockers.push(eye.group);
  if (!blockers.length) return false;
  const blockerHit = raycaster.intersectObjects(blockers, true)[0];
  return Boolean(blockerHit && blockerHit.distance <= headHit.distance + 0.002);
}

function buildPaintStamp(width) {
  const nextKey = `${width}|${paintHardness.value}|${paintColour.value}|${activePaintErase}`;
  if (paintStampKey === nextKey) return paintStampCanvas.width;
  paintStampKey = nextKey;
  const stampSize = Math.max(4, Math.ceil(width + 4));
  paintStampCanvas.width = stampSize;
  paintStampCanvas.height = stampSize;
  const center = stampSize * 0.5;
  const radius = width * 0.5;
  const hardness = 1 - Number(paintHardness.value) / 100;
  const solidEdge = Math.min(0.999, hardness);
  const gradient = paintStampContext.createRadialGradient(center, center, 0, center, center, radius);
  const colour = activePaintErase ? '#ffffff' : paintColour.value;
  gradient.addColorStop(0, colour);
  gradient.addColorStop(solidEdge, colour);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  paintStampContext.clearRect(0, 0, stampSize, stampSize);
  paintStampContext.fillStyle = gradient;
  paintStampContext.fillRect(0, 0, stampSize, stampSize);
  return stampSize;
}

function stampPaint(point, width, stampSize) {
  paintHasContent = true;
  if (paintLayer) paintLayer.visible = true;
  paintStrokeContext.drawImage(paintStampCanvas, point.x - stampSize * 0.5, point.y - stampSize * 0.5);
  const half = stampSize * 0.5 + 2;
  if (!paintDirtyBounds) {
    paintDirtyBounds = { minX: point.x - half, minY: point.y - half, maxX: point.x + half, maxY: point.y + half };
  } else {
    paintDirtyBounds.minX = Math.min(paintDirtyBounds.minX, point.x - half);
    paintDirtyBounds.minY = Math.min(paintDirtyBounds.minY, point.y - half);
    paintDirtyBounds.maxX = Math.max(paintDirtyBounds.maxX, point.x + half);
    paintDirtyBounds.maxY = Math.max(paintDirtyBounds.maxY, point.y + half);
  }
}

function getPaintDirtyRect() {
  if (!paintDirtyBounds) return null;
  const x = Math.max(0, Math.floor(paintDirtyBounds.minX));
  const y = Math.max(0, Math.floor(paintDirtyBounds.minY));
  const right = Math.min(PAINT_TEXTURE_SIZE, Math.ceil(paintDirtyBounds.maxX));
  const bottom = Math.min(PAINT_TEXTURE_SIZE, Math.ceil(paintDirtyBounds.maxY));
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

function queuePaintTextureUpdate() {
  if (paintTextureUpdateQueued) return;
  paintTextureUpdateQueued = true;
  requestAnimationFrame(() => {
    paintTextureUpdateQueued = false;
    if (paintTexture) paintTexture.needsUpdate = true;
  });
}

function renderPaintComposite(showActiveStroke = true) {
  const dirty = getPaintDirtyRect();
  if (!dirty || dirty.width === 0 || dirty.height === 0) return;
  const { x, y, width, height } = dirty;
  paintContext.clearRect(x, y, width, height);
  paintContext.drawImage(paintBaseCanvas, x, y, width, height, x, y, width, height);
  if (showActiveStroke) {
    paintContext.save();
    paintContext.globalCompositeOperation = activePaintErase ? 'destination-out' : 'source-over';
    paintContext.globalAlpha = activePaintOpacity;
    paintContext.drawImage(paintStrokeCanvas, x, y, width, height, x, y, width, height);
    paintContext.restore();
  }
  queuePaintTextureUpdate();
}

function beginPaintStroke() {
  paintStrokeContext.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE);
  activePaintErase = paintEraseMode;
  activePaintOpacity = Number(paintOpacity.value) / 100;
  paintDirtyBounds = null;
  previousPaintPoint = null;
}

function commitPaintStroke() {
  const dirty = getPaintDirtyRect();
  if (!dirty) return;
  const { x, y, width, height } = dirty;
  paintBaseContext.save();
  paintBaseContext.globalCompositeOperation = activePaintErase ? 'destination-out' : 'source-over';
  paintBaseContext.globalAlpha = activePaintOpacity;
  paintBaseContext.drawImage(paintStrokeCanvas, x, y, width, height, x, y, width, height);
  paintBaseContext.restore();
  paintHasContent = true;
  if (paintLayer) paintLayer.visible = true;
  paintStrokeContext.clearRect(x, y, width, height);
  renderPaintComposite(false);
  paintDirtyBounds = null;
  recordPaintState();
}

function paintAtPointer() {
  if (!paintContext || !paintTexture || !head) return false;
  const hit = raycaster.intersectObject(head, false)[0];
  if (!hit?.uv || paintBlockerIsCloser(hit)) {
    previousPaintPoint = null;
    return false;
  }
  const point = {
    x: hit.uv.x * PAINT_TEXTURE_SIZE,
    y: (1 - hit.uv.y) * PAINT_TEXTURE_SIZE
  };
  const width = Number(paintSize.value || 24) * PAINT_SIZE_SCALE;
  const stampSize = buildPaintStamp(width);
  if (previousPaintPoint && Math.hypot(point.x - previousPaintPoint.x, point.y - previousPaintPoint.y) < PAINT_TEXTURE_SIZE * 0.16) {
    const distance = Math.hypot(point.x - previousPaintPoint.x, point.y - previousPaintPoint.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, width * 0.22)));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      stampPaint({
        x: THREE.MathUtils.lerp(previousPaintPoint.x, point.x, t),
        y: THREE.MathUtils.lerp(previousPaintPoint.y, point.y, t)
      }, width, stampSize);
    }
  } else {
    stampPaint(point, width, stampSize);
  }
  previousPaintPoint = point;
  renderPaintComposite(true);
  return true;
}

function updatePaintCursor(event) {
  if (!paintMode || !head || dragging) return;
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const headHit = raycaster.intersectObject(head, false)[0];
  const canPaint = Boolean(headHit?.uv && !paintBlockerIsCloser(headHit));
  stage.classList.toggle('brush-over-head', canPaint);
  paintCursor.style.display = canPaint ? 'block' : 'none';
  if (!canPaint) return;
  const size = Math.max(5, Number(paintSize.value || 24) * 0.40);
  paintCursor.style.left = `${event.clientX}px`;
  paintCursor.style.top = `${event.clientY}px`;
  paintCursor.style.width = `${size}px`;
  paintCursor.style.height = `${size}px`;
  paintCursor.style.opacity = '1';
  paintCursor.style.boxShadow = '0 0 1px #000';
}

function aimEyes(event) {
  const rect = canvas.getBoundingClientRect();
  eyeLookTarget.x = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
  eyeLookTarget.y = THREE.MathUtils.clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
}

function addTrackingEyes() {
  const rimGeometry = new THREE.CircleGeometry(0.0365, 32);
  rimGeometry.scale(1, 0.72, 1);
  const irisGeometry = new THREE.CircleGeometry(0.0275, 28);
  irisGeometry.scale(1, 0.72, 1);
  const pupilGeometry = new THREE.CircleGeometry(0.0125, 24);
  pupilGeometry.scale(1, 0.88, 1);
  const highlightGeometry = new THREE.CircleGeometry(0.004, 16);
  const rimMaterial = new THREE.MeshBasicMaterial({
    color: 0xd5d0c8,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.5
  });
  const irisMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3512,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    // Keep every added-eye layer in the same render queue so renderOrder
    // places the solid iris above the half-transparent white backing.
    transparent: true,
    opacity: 1
  });
  const pupilMaterial = new THREE.MeshBasicMaterial({
    color: 0x080000,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 1
  });
  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffeee6,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 1
  });

  for (const spec of EYE_SPECS) {
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < positions.count; i++) {
      tempVertex.fromArray(rest, i * 3);
      const distance = tempVertex.distanceTo(spec);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    }
    const eyeGroup = new THREE.Group();
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    const iris = new THREE.Mesh(irisGeometry, irisMaterial);
    const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    rim.renderOrder = 89;
    iris.renderOrder = 90;
    pupil.renderOrder = 91;
    highlight.renderOrder = 92;
    rim.position.z = 0;
    iris.position.z = 0.0008;
    pupil.position.z = 0.0012;
    highlight.position.z = 0.0022;
    eyeGroup.add(rim, iris, pupil, highlight);
    head.add(eyeGroup);
    pupils.push({
      group: eyeGroup,
      rim,
      iris,
      pupil,
      highlight,
      anchor: nearest,
      offsetX: spec.offsetX,
      offsetY: spec.offsetY,
      offsetZ: spec.offsetZ,
      size: spec.size
    });
  }
}

function buildSmileMap() {
  if (!head || !modelPivot || !positions || !rest) return;
  const corners = [
    { point: new THREE.Vector3(-0.27, -0.50, 0.50), side: -1 },
    { point: new THREE.Vector3(0.27, -0.50, 0.50), side: 1 }
  ];
  const radius = 0.21;
  const chosen = new Map();

  for (const corner of corners) {
    const localCorner = head.worldToLocal(modelPivot.localToWorld(corner.point.clone()));
    for (let i = 0; i < positions.count; i++) {
      tempVertex.fromArray(rest, i * 3);
      const distance = tempVertex.distanceTo(localCorner);
      if (distance >= radius) continue;
      const t = 1 - distance / radius;
      const weight = t * t * (3 - 2 * t);
      const previous = chosen.get(i);
      if (!previous || weight > previous.weight) chosen.set(i, { index: i, side: corner.side, weight });
    }
  }
  smileVertices = [...chosen.values()];
}

function buildStonerMap() {
  if (!head || !modelPivot || !positions || !rest) return;
  const eyeCenters = [
    new THREE.Vector3(-0.196, 0.755, 0.395),
    new THREE.Vector3(0.186, 0.757, 0.418)
  ];
  const radius = 0.15;
  const chosen = new Map();
  for (const point of eyeCenters) {
    const localCenter = head.worldToLocal(modelPivot.localToWorld(point.clone()));
    for (let i = 0; i < positions.count; i++) {
      tempVertex.fromArray(rest, i * 3);
      if (tempVertex.y < localCenter.y - 0.015) continue;
      const distance = tempVertex.distanceTo(localCenter);
      if (distance >= radius) continue;
      const t = 1 - distance / radius;
      const weight = t * t * (3 - 2 * t);
      const previous = chosen.get(i) || 0;
      if (weight > previous) chosen.set(i, weight);
    }
  }
  stonerVertices = [...chosen].map(([index, weight]) => ({ index, weight }));
}

function buildBlinkMap() {
  if (!head || !modelPivot || !positions || !rest) return;
  const chosen = new Map();
  for (const spec of EYE_SPECS) {
    const centre = head.worldToLocal(modelPivot.localToWorld(
      new THREE.Vector3(spec.x, spec.y, spec.z)
    ));
    for (let i = 0; i < positions.count; i++) {
      tempVertex.fromArray(rest, i * 3);
      const dx = (tempVertex.x - centre.x) / 0.16;
      const dy = (tempVertex.y - centre.y) / 0.105;
      const dz = (tempVertex.z - centre.z) / 0.13;
      const distance = dx * dx + dy * dy + dz * dz;
      if (distance >= 1) continue;
      const t = 1 - Math.sqrt(distance);
      const weight = t * t * (3 - 2 * t);
      const candidate = {
        index: i,
        targetY: centre.y - tempVertex.y,
        weight
      };
      const previous = chosen.get(i);
      if (!previous || weight > previous.weight) chosen.set(i, candidate);
    }
  }
  blinkVertices = [...chosen.values()];
}

function buildCombinedDeformationMap() {
  const combined = new Map();
  const getEntry = (index) => {
    if (!combined.has(index)) combined.set(index, { index, smileWeight: 0, smileSide: 0, stonerWeight: 0, blinkWeight: 0, blinkTargetY: 0 });
    return combined.get(index);
  };
  for (const vertex of smileVertices) {
    const entry = getEntry(vertex.index);
    entry.smileWeight = vertex.weight;
    entry.smileSide = vertex.side;
  }
  for (const vertex of stonerVertices) getEntry(vertex.index).stonerWeight = vertex.weight;
  for (const vertex of blinkVertices) {
    const entry = getEntry(vertex.index);
    entry.blinkWeight = vertex.weight;
    entry.blinkTargetY = vertex.targetY;
  }
  combinedDeformationVertices = [...combined.values()];
}

async function prepareGroan() {
  if (!groanContext) {
    groanContext = new AudioContext();
    groanMasterGain = groanContext.createGain();
    groanMasterGain.gain.value = 0.5;
    groanMasterGain.connect(groanContext.destination);
  }
  if (groanContext.state === 'suspended') await groanContext.resume();
  if (groanBuffer) return;
  try {
    const response = await fetch('./jack-eugh.mp3?v=1');
    const decodedGroan = await groanContext.decodeAudioData(await response.arrayBuffer());
    groanOriginalBuffer = decodedGroan;
    groanLoopStart = decodedGroan.duration * 0.20;
    groanLoopEnd = decodedGroan.duration * 0.58;
    groanBuffer = buildGranularSustain(decodedGroan);
    if (dragging && dragMode === 'face' && performance.now() - faceDragStartedAt >= GROAN_DRAG_DELAY) startGroan();
  } catch (error) {
    console.error('Jack groan load failure', error);
  }
}

function findGroanLoop(buffer) {
  const samples = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  const starts = [];
  const ends = [];
  const collectCrossings = (from, to, list) => {
    const first = Math.max(1, Math.floor(from * rate));
    const last = Math.min(samples.length - 2, Math.floor(to * rate));
    for (let i = first; i < last; i++) {
      if (samples[i] <= 0 && samples[i + 1] > 0) list.push(i);
    }
  };
  collectCrossings(0.18, Math.min(0.42, buffer.duration * 0.44), starts);
  collectCrossings(Math.min(0.48, buffer.duration * 0.50), Math.min(buffer.duration - 0.12, 0.82), ends);
  let bestScore = Infinity;
  let bestStart = Math.floor(groanLoopStart * rate);
  let bestEnd = Math.floor(Math.min(groanLoopEnd, buffer.duration - 0.12) * rate);
  for (const start of starts) {
    for (const end of ends) {
      if (end - start < rate * 0.18) continue;
      let score = 0;
      for (let n = -48; n <= 48; n += 4) {
        const difference = samples[start + n] - samples[end + n];
        score += difference * difference;
      }
      if (score < bestScore) {
        bestScore = score;
        bestStart = start;
        bestEnd = end;
      }
    }
  }
  groanLoopStart = bestStart / rate;
  groanLoopEnd = bestEnd / rate;
}

function buildCrossfadedGroan(sourceBuffer) {
  const rate = sourceBuffer.sampleRate;
  const start = Math.floor(groanLoopStart * rate);
  const end = Math.floor(groanLoopEnd * rate);
  const fadeSamples = Math.min(
    Math.floor(rate * 0.11),
    Math.floor((end - start) * 0.30)
  );
  const result = groanContext.createBuffer(
    sourceBuffer.numberOfChannels,
    sourceBuffer.length,
    rate
  );
  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const source = sourceBuffer.getChannelData(channel);
    const output = result.getChannelData(channel);
    output.set(source);
    // Blend the loop's final section into its opening. The source then loops
    // from the end of this blend to the corresponding point near its start.
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / Math.max(1, fadeSamples - 1);
      const fadeOut = 1 - t;
      const fadeIn = t;
      output[end - fadeSamples + i] =
        source[end - fadeSamples + i] * fadeOut +
        source[start + i] * fadeIn;
    }
  }
  groanLoopStart += fadeSamples / rate;
  return result;
}

function buildGranularSustain(sourceBuffer) {
  const rate = sourceBuffer.sampleRate;
  const outputLength = Math.floor(rate * 3.8);
  const grainLength = Math.floor(rate * 0.18);
  const hop = Math.floor(rate * 0.055);
  const sourceStart = Math.floor(groanLoopStart * rate);
  const sourceEnd = Math.max(sourceStart + grainLength, Math.floor(groanLoopEnd * rate) - grainLength);
  const result = groanContext.createBuffer(sourceBuffer.numberOfChannels, outputLength, rate);
  const weights = new Float32Array(outputLength);
  let grainNumber = 0;
  const totalGrains = Math.ceil((outputLength + grainLength) / hop);
  for (let outputStart = -grainLength; outputStart < outputLength; outputStart += hop) {
    // Travel across the vowel once over several seconds and return smoothly
    // before the buffer loops. The previous per-grain jumps caused the rapid
    // "wewewewe" modulation.
    const wander = Math.sin((grainNumber / totalGrains) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
    const grainStart = sourceStart + Math.floor((sourceEnd - sourceStart) * wander);
    for (let i = 0; i < grainLength; i++) {
      const outputIndex = outputStart + i;
      if (outputIndex < 0 || outputIndex >= outputLength) continue;
      const window = 0.5 - 0.5 * Math.cos((Math.PI * 2 * i) / Math.max(1, grainLength - 1));
      weights[outputIndex] += window;
      for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
        result.getChannelData(channel)[outputIndex] +=
          sourceBuffer.getChannelData(channel)[grainStart + i] * window;
      }
    }
    grainNumber++;
  }
  for (let channel = 0; channel < result.numberOfChannels; channel++) {
    const output = result.getChannelData(channel);
    for (let i = 0; i < output.length; i++) {
      if (weights[i] > 0.001) output[i] /= weights[i];
    }
  }
  return result;
}

function scheduleGroan() {
  faceDragStartedAt = performance.now();
  clearTimeout(groanTimer);
  groanTimer = null;
  if (Math.random() >= GROAN_CHANCE) return;
  prepareGroan();
  groanTimer = setTimeout(() => {
    if (dragging && dragMode === 'face') startGroan();
  }, GROAN_DRAG_DELAY);
}

function startGroan() {
  if (!groanContext || !groanBuffer || !groanOriginalBuffer || groanSource) return;
  const now = groanContext.currentTime;
  const introDuration = groanLoopStart;

  groanIntroSource = groanContext.createBufferSource();
  groanIntroSource.buffer = groanOriginalBuffer;
  groanIntroSource.connect(groanMasterGain);
  groanIntroSource.start(now, 0, introDuration + 0.045);

  groanSource = groanContext.createBufferSource();
  groanSource.buffer = groanBuffer;
  groanSource.loop = true;
  groanSustainGain = groanContext.createGain();
  groanSustainGain.gain.setValueAtTime(0, now + introDuration - 0.035);
  groanSustainGain.gain.linearRampToValueAtTime(1, now + introDuration + 0.045);
  groanSource.connect(groanSustainGain).connect(groanMasterGain);
  const thisSource = groanSource;
  groanSource.onended = () => {
    if (groanSource === thisSource) groanSource = null;
  };
  groanSource.start(now + introDuration - 0.035);
}

function releaseGroan() {
  clearTimeout(groanTimer);
  groanTimer = null;
  if (!groanContext || !groanOriginalBuffer || !groanSource) return;
  const now = groanContext.currentTime;
  if (groanIntroSource) {
    try { groanIntroSource.stop(now + 0.065); } catch {}
    groanIntroSource = null;
  }
  if (groanSustainGain) {
    groanSustainGain.gain.cancelScheduledValues(now);
    groanSustainGain.gain.setValueAtTime(groanSustainGain.gain.value, now);
    groanSustainGain.gain.linearRampToValueAtTime(0, now + 0.085);
  }
  const endingSource = groanSource;
  try { endingSource.stop(now + 0.09); } catch {}

  groanTailSource = groanContext.createBufferSource();
  groanTailSource.buffer = groanOriginalBuffer;
  const tailGain = groanContext.createGain();
  tailGain.gain.setValueAtTime(0, now);
  tailGain.gain.linearRampToValueAtTime(1, now + 0.075);
  groanTailSource.connect(tailGain).connect(groanMasterGain);
  groanTailSource.start(now, groanLoopEnd);
  groanTailSource.onended = () => { groanTailSource = null; };
}

function beginDrag(event) {
  if (!head || activePointer !== null) return;
  if (jointTransform.axis) return;
  if (event.button === 0 && jointTransform.object) jointTransform.detach();
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const jointHit = jointRoot && !jointSpitting
    ? raycaster.intersectObject(jointRoot, true)[0]
    : null;
  if (paintMode && jointHit) setPaintMode(false);
  if (paintMode) {
    event.preventDefault();
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    dragging = true;
    dragMode = 'paint';
    beginPaintStroke();
    paintAtPointer();
    return;
  }
  if (jointRoot && !jointSpitting) {
    if (jointHit) {
      event.preventDefault();
      if (event.button === 2) {
        jointTransform.attach(jointRoot);
        return;
      }
      if (event.button !== 0) return;
      if (jointSnapped) detachJoint();
      activePointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      dragging = true;
      dragMode = 'joint';
      stage.classList.add('grabbing');
      camera.getWorldDirection(cameraDirection);
      dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, jointRoot.position);
      jointDragOffset.subVectors(jointRoot.position, jointHit.point);
      return;
    }
  }
  const hit = raycaster.intersectObject(head, false)[0];
  if (!hit) return;

  event.preventDefault();
  activePointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  dragging = true;
  dragMode = 'face';
  fullFaceRecoveryAt = 0;
  stage.classList.add('grabbing');

  startWorld.copy(hit.point);
  camera.getWorldDirection(cameraDirection);
  dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, startWorld);
  inverseWorld.copy(head.matrixWorld).invert();
  startLocal.copy(startWorld).applyMatrix4(inverseWorld);

  active = [];
  weights = [];
  for (let i = 0; i < positions.count; i++) {
    tempVertex.fromArray(rest, i * 3);
    const distance = tempVertex.distanceTo(startLocal);
    if (distance < GRAB_RADIUS) {
      const normalized = 1 - distance / GRAB_RADIUS;
      active.push(i);
      weights.push(normalized * normalized * (3 - 2 * normalized));
    }
  }
  lastMoveTime = performance.now();
  lastDesired.set(0, 0, 0);
  scheduleGroan();
}

function moveDrag(event) {
  if (!dragging || event.pointerId !== activePointer) return;
  event.preventDefault();
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  if (dragMode === 'paint') {
    paintAtPointer();
    return;
  }
  if (dragMode === 'face') {
    const headwearWalls = [];
    if (duragEquipped && duragRoot?.visible) headwearWalls.push(duragRoot);
    if (bandanaEquipped && bandanaRoot?.visible) headwearWalls.push(bandanaRoot);
    if (headwearWalls.length && raycaster.intersectObjects(headwearWalls, true).length) return;
  }
  if (!raycaster.ray.intersectPlane(dragPlane, planeHit)) return;

  if (dragMode === 'joint') {
    jointRoot.position.copy(planeHit).add(jointDragOffset);
    return;
  }

  currentWorld.copy(planeHit);
  currentLocal.copy(currentWorld).applyMatrix4(inverseWorld);
  localDelta.subVectors(currentLocal, startLocal);
  if (localDelta.length() > MAX_PULL) localDelta.setLength(MAX_PULL);

  const now = performance.now();
  const dt = Math.max(1 / 240, Math.min(0.05, (now - lastMoveTime) / 1000));
  for (let n = 0; n < active.length; n++) {
    const i3 = active[n] * 3;
    const weight = weights[n];
    const desiredX = localDelta.x * weight;
    const desiredY = localDelta.y * weight;
    const desiredZ = localDelta.z * weight;
    velocities[i3] = (desiredX - offsets[i3]) / dt * 0.42;
    velocities[i3 + 1] = (desiredY - offsets[i3 + 1]) / dt * 0.42;
    velocities[i3 + 2] = (desiredZ - offsets[i3 + 2]) / dt * 0.42;
    offsets[i3] = desiredX;
    offsets[i3 + 1] = desiredY;
    offsets[i3 + 2] = desiredZ;
  }
  lastDesired.copy(localDelta);
  lastMoveTime = now;
}

function endDrag(event) {
  if (event.pointerId !== activePointer) return;
  const endedMode = dragMode;
  if (dragMode === 'joint' && jointRoot && modelPivot) {
    snapJointToHeadSurface();
  }
  dragging = false;
  dragMode = null;
  activePointer = null;
  stage.classList.remove('grabbing');
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  if (endedMode === 'face') releaseGroan();
  if (endedMode === 'face') fullFaceRecoveryAt = performance.now() + 10000;
  if (endedMode === 'paint') {
    commitPaintStroke();
    previousPaintPoint = null;
  }
}

function equipDurag() {
  if (!duragRoot || !modelPivot) return;
  detachBandana();
  modelPivot.attach(duragRoot);
  duragRoot.position.set(0, 0, 0);
  duragRoot.rotation.set(0, 0, 0);
  duragRoot.scale.setScalar(1);
  duragRoot.visible = true;
  duragEquipped = true;
  duragButton.setAttribute('aria-pressed', 'true');
  duragButton.title = 'Remove durag';
  emitHeadwearPoof(duragRoot);
}

function equipBandana() {
  if (!bandanaRoot || !modelPivot) return;
  detachDurag();
  modelPivot.attach(bandanaRoot);
  bandanaRoot.position.set(0, 0, 0);
  bandanaRoot.rotation.set(0, 0, 0);
  bandanaRoot.scale.setScalar(1);
  bandanaRoot.visible = true;
  bandanaEquipped = true;
  bandanaButton.setAttribute('aria-pressed', 'true');
  bandanaButton.title = 'Remove Sidney bandana';
  emitHeadwearPoof(bandanaRoot);
}

function emitHeadwearPoof(headwearRoot) {
  if (!modelPivot || !headwearRoot) return;
  modelPivot.updateMatrixWorld(true);
  // One reliable attachment point at the top-front of Jackhachi's skull.
  // It follows the head pivot, independent of accessory shape or trailing cloth.
  const centre = modelPivot.localToWorld(new THREE.Vector3(-0.17, 0.40, 0.48));
  const smokeType = headwearRoot === duragRoot ? 'durag' : 'bandana';
  for (let i = 0; i < 30; i++) {
    // Jump around the circle instead of drawing it clockwise, so even the
    // first few delayed puffs form one centred cloud.
    const angle = (((i * 13) % 30) / 30) * Math.PI * 2;
    const radius = 0.035 + (i % 5) * 0.038;
    const point = centre.clone().add(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0.08 + (i % 3) * 0.018
    ));
    setTimeout(() => emitSmokeAtWorld(point, true, true, 3.8, smokeType), i * 18);
  }
}

function toggleJointItem() {
  if (!jointRoot || jointSnapped || jointSpitting) return;
  if (jointRoot.visible && !jointDropping) {
    jointRoot.visible = false;
    jointTransform.detach();
    jointButton.setAttribute('aria-pressed', 'false');
    return;
  }
  jointRoot.visible = true;
  jointDropping = true;
  jointDropVelocity = 0;
  jointDropBounces = 0;
  jointRoot.position.set(JOINT_LOOSE_POSITION.x, 1.65, JOINT_LOOSE_POSITION.z);
  jointRoot.rotation.copy(jointRestRotation);
  jointButton.setAttribute('aria-pressed', 'true');
}

function detachDurag() {
  if (!duragRoot || !duragEquipped) return;
  duragRoot.visible = false;
  duragEquipped = false;
  duragButton.setAttribute('aria-pressed', 'false');
  duragButton.title = 'Equip durag';
}

function detachBandana() {
  if (!bandanaRoot || !bandanaEquipped) return;
  bandanaRoot.visible = false;
  bandanaEquipped = false;
  bandanaButton.setAttribute('aria-pressed', 'false');
  bandanaButton.title = 'Equip Sidney bandana';
}

function snapJointToHeadSurface() {
  if (!jointRoot || !jointContact || !modelPivot) return;
  const contactWorld = jointContact.getWorldPosition(new THREE.Vector3());
  const contactLocal = modelPivot.worldToLocal(contactWorld.clone());
  const dx = contactLocal.x - JOINT_LIP_CENTER.x;
  const dy = contactLocal.y - JOINT_LIP_CENTER.y;
  const captureDistance = (dx * dx) / (JOINT_LIP_CAPTURE_X * JOINT_LIP_CAPTURE_X)
    + (dy * dy) / (JOINT_LIP_CAPTURE_Y * JOINT_LIP_CAPTURE_Y);
  if (captureDistance > 1) return;

  // Every point in the painted lip shape is valid. Preserve an inside drop;
  // pull a near miss only as far as the nearest edge of that lip ellipse.
  const lipDistance = Math.sqrt(
    (dx * dx) / (JOINT_LIP_RADIUS_X * JOINT_LIP_RADIUS_X)
    + (dy * dy) / (JOINT_LIP_RADIUS_Y * JOINT_LIP_RADIUS_Y)
  );
  const lipScale = lipDistance > 1 ? 1 / lipDistance : 1;
  JOINT_MOUTH_ANCHOR.set(
    JOINT_LIP_CENTER.x + dx * lipScale,
    JOINT_LIP_CENTER.y + dy * lipScale,
    JOINT_LIP_CENTER.z
  );

  modelPivot.attach(jointRoot);
  jointRoot.scale.setScalar(JOINT_SCALE);
  anchorJointContactToMouth();
  jointSnapped = true;
  bindJointToMouthMesh();
  jointSnappedAt = performance.now();
  nextNoseExhaleAt = jointSnappedAt + 6500;
  noseExhaleUntil = 0;
}

function bindJointToMouthMesh() {
  if (!head || !positions || !modelPivot || !jointRoot) return;
  const anchorInHead = head.worldToLocal(modelPivot.localToWorld(JOINT_MOUTH_ANCHOR.clone()));
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < positions.count; i++) {
    tempVertex.fromArray(positions.array, i * 3);
    const distance = tempVertex.distanceToSquared(anchorInHead);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  jointAnchorIndex = nearestIndex;
  tempVertex.fromArray(positions.array, nearestIndex * 3);
  head.localToWorld(tempVertex);
  modelPivot.worldToLocal(tempVertex);
  jointSnapOffset.subVectors(jointRoot.position, tempVertex);
}

function anchorJointContactToMouth() {
  if (!jointRoot || !jointContact || !modelPivot) return;
  jointRoot.updateMatrixWorld(true);
  const contactInPivot = modelPivot.worldToLocal(jointContact.getWorldPosition(new THREE.Vector3()));
  jointContactFromRoot.subVectors(contactInPivot, jointRoot.position);
  jointRoot.position.copy(JOINT_MOUTH_ANCHOR).sub(jointContactFromRoot);
  jointRoot.updateMatrixWorld(true);
}

function detachJoint() {
  if (!jointRoot || !jointSnapped) return;
  scene.attach(jointRoot);
  jointSnapped = false;
  jointSnappedAt = 0;
  jointAnchorIndex = null;
}

function spitFinishedJoint(now) {
  if (!jointRoot || jointSpitting) return;
  scene.attach(jointRoot);
  jointSnapped = false;
  jointAnchorIndex = null;
  jointSpitting = true;
  jointTransform.detach();
  jointSpitAt = now;
  jointSpitVelocity.set(0.48, -0.16, 0.12);
}

function retireFinishedJoint() {
  if (!jointRoot || !jointVisual) return;
  scene.attach(jointRoot);
  jointRoot.position.copy(JOINT_LOOSE_POSITION);
  jointRoot.rotation.copy(jointRestRotation);
  jointRoot.scale.setScalar(JOINT_SCALE);
  jointVisual.scale.x = 1;
  jointVisual.position.x = 0;
  if (jointInhaleVisual) {
    jointInhaleVisual.scale.x = 1;
    jointInhaleVisual.position.x = 0;
  }
  smokedFraction = 0;
  jointSpitting = false;
  jointSpitAt = 0;
  jointTip.position.x = JOINT_CONTACT_X + JOINT_FULL_LENGTH;
  jointRoot.visible = false;
  jointTransform.detach();
  jointButton.setAttribute('aria-pressed', 'false');
}

function emitTerribleSmoke(heavy = false) {
  if (!jointTip || !jointSnapped) return;
  jointTip.getWorldPosition(jointTipWorld);
  emitSmokeAtWorld(jointTipWorld, false, heavy);
}

function emitNoseSmoke(side = 1) {
  if (!head || !jointSnapped) return;
  // Two deliberately rough nostril outlets, attached to the moving head.
  const nostril = new THREE.Vector3(0.052 * side, 0.455, 0.535);
  head.localToWorld(nostril);
  emitSmokeAtWorld(nostril, true);
}

function emitSmokeAtWorld(worldPoint, fromNose, heavy = false, sizeMultiplier = 1, headwearType = '') {
  projectedTip.copy(worldPoint).project(camera);
  if (projectedTip.z < -1 || projectedTip.z > 1) return;
  const puff = smokePool.pop() || document.createElement('span');
  puff.className = `smoke-puff${fromNose ? ' nose-smoke' : ''}${headwearType ? ` headwear-smoke ${headwearType}-smoke` : ''}`;
  puff.style.left = `${(projectedTip.x * 0.5 + 0.5) * stage.clientWidth}px`;
  puff.style.top = `${(-projectedTip.y * 0.5 + 0.5) * stage.clientHeight}px`;
  const drift = Math.round(Math.random() * (fromNose ? 44 : 70) - (fromNose ? 22 : 35));
  const baseSize = (fromNose ? 30 : heavy ? 31 : 22) + Math.round(Math.random() * 13);
  puff.style.setProperty('--smoke-size', `${baseSize * sizeMultiplier}px`);
  const life = (fromNose ? 3.5 : 2.8) + Math.random() * 1.25;
  puff.style.setProperty('--smoke-life', `${headwearType ? life * 0.7 : life}s`);
  puff.style.setProperty('--smoke-drift', `${drift}px`);
  puff.style.setProperty('--smoke-drift-end', `${drift + Math.round(Math.random() * 50 - 25)}px`);
  puff.style.setProperty('--smoke-turn', `${Math.round(Math.random() * 34 - 17)}deg`);
  puff.style.setProperty('--smoke-turn-end', `${Math.round(Math.random() * 70 - 35)}deg`);
  smokeLayer.append(puff);
  puff.addEventListener('animationend', () => {
    puff.remove();
    if (smokePool.length < 80) smokePool.push(puff);
  }, { once: true });
}

function restoreFactoryFace() {
  if (!positions) return;
  releaseGroan();
  dragging = false;
  dragMode = null;
  activePointer = null;
  stage.classList.remove('grabbing');
  for (let n = 0; n < active.length; n++) {
    const i3 = active[n] * 3;
    velocities[i3] -= offsets[i3] * 2.2;
    velocities[i3 + 1] -= offsets[i3 + 1] * 2.2;
    velocities[i3 + 2] -= offsets[i3 + 2] * 2.2;
  }
  eyeLookTarget.set(0, 0);
  smokedFraction = 0;
  jointSpitting = false;
  jointSpitAt = 0;
  if (jointVisual) {
    jointVisual.scale.x = 1;
    jointVisual.position.x = 0;
  }
  if (jointTip) jointTip.position.x = JOINT_CONTACT_X + JOINT_FULL_LENGTH;
  if (jointInhaleVisual) {
    jointInhaleVisual.scale.x = 1;
    jointInhaleVisual.position.x = 0;
  }
  for (const material of jointInhaleMaterials) material.opacity = 0;
}

function wrappedAngleDifference(value, reference) {
  return ((value - reference + 540) % 360) - 180;
}

function resetMotionReference() {
  motionReferenceBeta = null;
  motionReferenceGamma = null;
  motionPreviousBeta = null;
  motionPreviousGamma = null;
  lastOrientationMovementAt = performance.now();
  motionTargetYaw = 0;
  motionTargetPitch = 0;
  motionTargetRoll = 0;
  motionLookTarget.set(0, 0);
}

function bufferedMotionAmount(value, fullRange) {
  const magnitude = Math.abs(value);
  if (magnitude <= MOTION_DEAD_ZONE) return 0;
  return Math.sign(value) * THREE.MathUtils.clamp(
    (magnitude - MOTION_DEAD_ZONE) / (fullRange - MOTION_DEAD_ZONE),
    0,
    1
  );
}

function handleDeviceOrientation(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  if (motionReferenceBeta === null || motionReferenceGamma === null) {
    motionReferenceBeta = event.beta;
    motionReferenceGamma = event.gamma;
    motionPreviousBeta = event.beta;
    motionPreviousGamma = event.gamma;
    lastOrientationMovementAt = performance.now();
    return;
  }


  const now = performance.now();
  const frameMovement = Math.max(
    Math.abs(wrappedAngleDifference(event.beta, motionPreviousBeta ?? event.beta)),
    Math.abs(wrappedAngleDifference(event.gamma, motionPreviousGamma ?? event.gamma))
  );
  motionPreviousBeta = event.beta;
  motionPreviousGamma = event.gamma;
  if (frameMovement > 0.55) lastOrientationMovementAt = now;

  // Once the phone has rested for a moment, gently make that position neutral.
  // This prevents a phone lying on a table from leaving Jackhachi staring upward.
  if (now - lastOrientationMovementAt >= MOTION_SETTLE_DELAY) {
    motionReferenceBeta += wrappedAngleDifference(event.beta, motionReferenceBeta) * 0.075;
    motionReferenceGamma += wrappedAngleDifference(event.gamma, motionReferenceGamma) * 0.075;
  }

  let horizontal = wrappedAngleDifference(event.gamma, motionReferenceGamma);
  let vertical = wrappedAngleDifference(event.beta, motionReferenceBeta);
  const screenAngle = window.screen?.orientation?.angle
    ?? window.orientation
    ?? 0;
  if (Math.abs(screenAngle) === 90) {
    const previousHorizontal = horizontal;
    horizontal = screenAngle > 0 ? vertical : -vertical;
    vertical = screenAngle > 0 ? -previousHorizontal : previousHorizontal;
  } else if (Math.abs(screenAngle) === 180) {
    horizontal *= -1;
    vertical *= -1;
  }

  const horizontalAmount = bufferedMotionAmount(horizontal, 34);
  const verticalAmount = bufferedMotionAmount(vertical, 38);
  motionTargetYaw = horizontalAmount * MOTION_TILT_LIMIT;
  motionTargetRoll = -horizontalAmount * MOTION_TILT_LIMIT * 0.68;
  motionTargetPitch = verticalAmount * MOTION_PITCH_LIMIT;
  motionLookTarget.set(horizontalAmount * 0.34, -verticalAmount * 0.26);
}

function handleDeviceMotion(event) {
  const acceleration = event.acceleration;
  const rotation = event.rotationRate;
  const ax = Number.isFinite(acceleration?.x) ? acceleration.x : 0;
  const ay = Number.isFinite(acceleration?.y) ? acceleration.y : 0;
  const az = Number.isFinite(acceleration?.z) ? acceleration.z : 0;
  const accelerationMagnitude = Math.hypot(ax, ay, az);
  const rotationMagnitude = Math.hypot(
    Number.isFinite(rotation?.alpha) ? rotation.alpha : 0,
    Number.isFinite(rotation?.beta) ? rotation.beta : 0,
    Number.isFinite(rotation?.gamma) ? rotation.gamma : 0
  );
  const now = performance.now();
  if ((accelerationMagnitude < 7.5 && rotationMagnitude < 210) || now - lastMotionKickAt < 260) return;

  const strength = THREE.MathUtils.clamp(
    Math.max(accelerationMagnitude / 16, rotationMagnitude / 520),
    0.25,
    0.85
  );
  const horizontalDirection = Math.abs(ax) > 0.35 ? Math.sign(ax) : (Math.random() < 0.5 ? -1 : 1);
  const verticalDirection = Math.abs(ay) > 0.35 ? Math.sign(ay) : (Math.random() < 0.5 ? -1 : 1);
  motionKickVelocity.x += -verticalDirection * strength * 0.32;
  motionKickVelocity.y += horizontalDirection * strength * 0.42;
  motionKickVelocity.z += -horizontalDirection * strength * 0.28;
  lastMotionKickAt = now;
}

function installMotionSensors() {
  if (motionSensorsInstalled) return;
  motionSensorsInstalled = true;
  window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
  window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
  window.addEventListener('orientationchange', resetMotionReference, { passive: true });
  window.screen?.orientation?.addEventListener?.('change', resetMotionReference);
}

async function requestMotionSensorsFromGesture() {
  if (motionSensorsInstalled || motionPermissionRequested) return;
  motionPermissionRequested = true;
  const requests = [];
  if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
    requests.push(window.DeviceOrientationEvent.requestPermission());
  }
  if (typeof window.DeviceMotionEvent?.requestPermission === 'function') {
    requests.push(window.DeviceMotionEvent.requestPermission());
  }
  if (!requests.length) {
    installMotionSensors();
    return;
  }
  try {
    const results = await Promise.allSettled(requests);
    if (results.some((result) => result.status === 'fulfilled' && result.value === 'granted')) {
      installMotionSensors();
    }
  } catch {
    // Unsupported or denied sensors simply leave the original controls intact.
  }
}

const likelyTouchDevice = navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
if (likelyTouchDevice) {
  const orientationNeedsPermission = typeof window.DeviceOrientationEvent?.requestPermission === 'function';
  const motionNeedsPermission = typeof window.DeviceMotionEvent?.requestPermission === 'function';
  if (!orientationNeedsPermission && !motionNeedsPermission) installMotionSensors();
}

canvas.addEventListener('pointerdown', beginDrag);
canvas.addEventListener('pointerdown', requestMotionSensorsFromGesture, { once: true });
let pendingPaintCursorEvent = null;
let paintCursorFrameQueued = false;
function schedulePaintCursorUpdate(event) {
  if (!paintMode || dragging) return;
  pendingPaintCursorEvent = { clientX: event.clientX, clientY: event.clientY };
  if (paintCursorFrameQueued) return;
  paintCursorFrameQueued = true;
  requestAnimationFrame(() => {
    paintCursorFrameQueued = false;
    if (pendingPaintCursorEvent) updatePaintCursor(pendingPaintCursorEvent);
    pendingPaintCursorEvent = null;
  });
}
canvas.addEventListener('pointermove', moveDrag);
canvas.addEventListener('pointermove', aimEyes);
canvas.addEventListener('pointermove', schedulePaintCursorUpdate);
canvas.addEventListener('pointerleave', () => {
  eyeLookTarget.set(0, 0);
  paintCursor.style.display = 'none';
  stage.classList.remove('brush-over-head');
});
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
jointTransform.addEventListener('objectChange', () => {
  if (jointSnapped) anchorJointContactToMouth();
});

if (resetButton) resetButton.addEventListener('click', restoreFactoryFace);
jointButton.addEventListener('click', toggleJointItem);
duragButton.addEventListener('click', () => {
  if (duragEquipped) detachDurag();
  else equipDurag();
});
bandanaButton.addEventListener('click', () => {
  if (bandanaEquipped) detachBandana();
  else equipBandana();
});
function setPaintMode(enabled) {
  paintMode = enabled;
  paintToggle.setAttribute('aria-pressed', String(paintMode));
  paintOptions.hidden = !paintMode;
  stage.classList.toggle('painting', paintMode);
  if (!paintMode) {
    paintCursor.style.display = 'none';
    stage.classList.remove('brush-over-head');
    document.querySelectorAll('.paint-panel').forEach((panel) => { panel.hidden = true; });
  }
}
paintToggle.addEventListener('click', () => {
  setPaintMode(!paintMode);
});
paintSize.addEventListener('input', () => { paintSizeValue.value = paintSize.value; });
paintHardness.addEventListener('input', () => { paintHardnessValue.value = `${paintHardness.value}%`; });
paintOpacity.addEventListener('input', () => { paintOpacityValue.value = `${paintOpacity.value}%`; });
paintColour.addEventListener('input', () => {
  paintColourSwatch.style.background = paintColour.value;
  document.querySelectorAll('.paint-swatch').forEach((swatch) => swatch.setAttribute('aria-pressed', 'false'));
});
document.querySelectorAll('[data-paint-panel]').forEach((button) => {
  button.addEventListener('click', () => {
    const selected = document.querySelector(`#paint-panel-${button.dataset.paintPanel}`);
    const willOpen = selected.hidden;
    document.querySelectorAll('.paint-panel').forEach((panel) => { panel.hidden = true; });
    document.querySelectorAll('[data-paint-panel]').forEach((other) => other.setAttribute('aria-pressed', 'false'));
    selected.hidden = !willOpen;
    button.setAttribute('aria-pressed', String(willOpen));
  });
});
for (const colour of CLASSIC_PAINT_COLOURS) {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'paint-swatch';
  swatch.style.background = colour;
  swatch.title = colour;
  swatch.setAttribute('aria-label', `Paint colour ${colour}`);
  swatch.setAttribute('aria-pressed', colour === paintColour.value ? 'true' : 'false');
  swatch.addEventListener('click', () => {
    paintColour.value = colour;
    paintColourSwatch.style.background = colour;
    document.querySelectorAll('.paint-swatch').forEach((other) => other.setAttribute('aria-pressed', String(other === swatch)));
  });
  document.querySelector('#paint-palette').append(swatch);
}
paintEraser.addEventListener('click', () => {
  paintEraseMode = !paintEraseMode;
  paintEraser.setAttribute('aria-pressed', String(paintEraseMode));
});
paintUndo.addEventListener('click', () => {
  if (paintHistory.length <= 1) return;
  paintRedoHistory.push(paintHistory.pop());
  restorePaintState(paintHistory[paintHistory.length - 1]);
});
paintRedo.addEventListener('click', () => {
  if (!paintRedoHistory.length) return;
  const snapshot = paintRedoHistory.pop();
  paintHistory.push(snapshot);
  restorePaintState(snapshot);
});
paintClear.addEventListener('click', () => {
  if (!paintContext || !paintTexture || !paintBaseContext || !paintStrokeContext) return;
  paintBaseContext.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE);
  paintStrokeContext.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE);
  paintContext.clearRect(0, 0, PAINT_TEXTURE_SIZE, PAINT_TEXTURE_SIZE);
  paintHasContent = false;
  if (paintLayer) paintLayer.visible = false;
  paintDirtyBounds = null;
  queuePaintTextureUpdate();
  recordPaintState();
});

let normalTimer = 0;
let lastFrameAt = 0;
function animate(frameTime = performance.now()) {
  requestAnimationFrame(animate);
  if (document.hidden) {
    lastFrameAt = frameTime;
    return;
  }
  const dt = lastFrameAt ? Math.min((frameTime - lastFrameAt) / 1000, 0.05) : 1 / 60;
  lastFrameAt = frameTime;
  const now = performance.now();
  idleTime += dt;
  entranceTime += dt;

  if (now >= nextBlinkAt) {
    blinkStartedAt = now;
    nextBlinkAt = now + 10000;
  }
  const blinkAge = (now - blinkStartedAt) / 190;
  const blinkAmount = blinkAge >= 0 && blinkAge <= 1
    ? Math.sin(blinkAge * Math.PI)
    : 0;

  if ((dragging || jointDropping) && idleState !== -1) {
    idleState = -1;
    nextIdleStateAt = now + 8500;
  } else if (!dragging && !jointDropping && idleState === -1 && now >= nextIdleStateAt) {
    idleState = Math.floor(Math.random() * 20);
    idleStateStartedAt = now;
    idleStateUntil = now + 1800 + Math.random() * 1300;
  } else if (idleState !== -1 && now >= idleStateUntil) {
    idleState = -1;
    nextIdleStateAt = now + 9100 + Math.random() * 9100;
  }

  let idleLookX = 0;
  let idleLookY = 0;
  let idleYaw = 0;
  let idlePitch = 0;
  let idleRoll = 0;
  let idleBob = 0;
  if (idleState !== -1) {
    const duration = Math.max(1, idleStateUntil - idleStateStartedAt);
    const progress = THREE.MathUtils.clamp((now - idleStateStartedAt) / duration, 0, 1);
    const envelope = Math.sin(progress * Math.PI);
    const wave = Math.sin(progress * Math.PI * 4);
    switch (idleState) {
      case 0: idleLookX = -0.82 * envelope; idleYaw = -0.10 * envelope; break;
      case 1: idleLookX = 0.82 * envelope; idleYaw = 0.10 * envelope; break;
      case 2: idleLookY = 0.78 * envelope; idlePitch = -0.07 * envelope; break;
      case 3: idleLookY = -0.58 * envelope; idlePitch = 0.055 * envelope; break;
      case 4: idleYaw = wave * 0.085 * envelope; idleRoll = -wave * 0.045 * envelope; break;
      case 5: idlePitch = wave * 0.055 * envelope; idleBob = -Math.abs(wave) * 0.018 * envelope; break;
      case 6: idleRoll = wave * 0.075 * envelope; idleLookX = wave * 0.40 * envelope; break;
      case 7: idleBob = Math.sin(progress * Math.PI * 8) * 0.026 * envelope; break;
      case 8:
        idleLookX = Math.cos(progress * Math.PI * 4) * 0.62 * envelope;
        idleLookY = Math.sin(progress * Math.PI * 4) * 0.52 * envelope;
        idleYaw = idleLookX * 0.07;
        break;
      case 9: idleLookY = 0.18 * envelope; idlePitch = -0.025 * envelope; idleRoll = 0.018 * envelope; break;
      case 10: idleYaw = Math.sin(progress * Math.PI * 2) * 0.13 * envelope; idleLookX = -idleYaw * 4; break;
      case 11: idlePitch = -Math.abs(wave) * 0.075 * envelope; idleLookY = 0.55 * envelope; break;
      case 12: idleRoll = Math.sin(progress * Math.PI * 6) * 0.035 * envelope; idleBob = Math.abs(wave) * 0.014 * envelope; break;
      case 13: idleLookX = Math.sign(Math.sin(progress * Math.PI * 5)) * 0.70 * envelope; break;
      case 14: idleLookY = Math.sign(Math.sin(progress * Math.PI * 3)) * 0.48 * envelope; idlePitch = -idleLookY * 0.055; break;
      case 15: idleYaw = -0.075 * envelope; idleRoll = 0.055 * envelope; idleLookX = 0.52 * envelope; break;
      case 16: idleYaw = 0.075 * envelope; idleRoll = -0.055 * envelope; idleLookX = -0.52 * envelope; break;
      case 17: idleBob = Math.sin(progress * Math.PI * 10) * 0.012 * envelope; idleRoll = wave * 0.028 * envelope; break;
      case 18: idleYaw = wave * 0.055 * envelope; idlePitch = Math.cos(progress * Math.PI * 4) * 0.035 * envelope; break;
      case 19: idleLookX = wave * 0.28 * envelope; idleLookY = Math.abs(wave) * 0.30 * envelope; idleBob = Math.abs(wave) * 0.012 * envelope; break;
    }
  }
  effectiveEyeLookTarget.set(
    THREE.MathUtils.clamp(eyeLookTarget.x + idleLookX + motionLook.x, -1, 1),
    THREE.MathUtils.clamp(eyeLookTarget.y + idleLookY + motionLook.y, -1, 1)
  );

  const motionEase = 1 - Math.exp(-5.2 * dt);
  motionYaw = THREE.MathUtils.lerp(motionYaw, motionTargetYaw, motionEase);
  motionPitch = THREE.MathUtils.lerp(motionPitch, motionTargetPitch, motionEase);
  motionRoll = THREE.MathUtils.lerp(motionRoll, motionTargetRoll, motionEase);
  motionLook.lerp(motionLookTarget, motionEase);
  motionKickVelocity.addScaledVector(motionKick, -20 * dt);
  motionKickVelocity.multiplyScalar(Math.exp(-6.2 * dt));
  motionKick.addScaledVector(motionKickVelocity, dt);
  motionKick.x = THREE.MathUtils.clamp(motionKick.x, -0.18, 0.18);
  motionKick.y = THREE.MathUtils.clamp(motionKick.y, -0.22, 0.22);
  motionKick.z = THREE.MathUtils.clamp(motionKick.z, -0.18, 0.18);

  if (jointDropping && jointRoot) {
    jointDropVelocity -= 4.8 * dt;
    jointRoot.position.y += jointDropVelocity * dt;
    jointRoot.rotation.z += 1.8 * dt;
    jointRoot.getWorldPosition(jointTipWorld);
    projectedTip.copy(jointTipWorld).project(camera);
    eyeLookTarget.set(
      THREE.MathUtils.clamp(projectedTip.x, -1, 1),
      THREE.MathUtils.clamp(projectedTip.y, -1, 1)
    );
    if (jointRoot.position.y <= JOINT_LOOSE_POSITION.y) {
      jointRoot.position.y = JOINT_LOOSE_POSITION.y;
      jointRoot.position.x = JOINT_LOOSE_POSITION.x;
      jointRoot.position.z = JOINT_LOOSE_POSITION.z;
      if (jointDropBounces < 3 && Math.abs(jointDropVelocity) > 0.45) {
        jointDropVelocity = Math.abs(jointDropVelocity) * 0.48;
        jointDropBounces += 1;
      } else {
        jointDropping = false;
        eyeLookTarget.set(0, 0);
        jointDropVelocity = 0;
        jointDropBounces = 0;
      }
    }
  }

  if (jointSnapped && jointAnchorIndex !== null && positions && modelPivot) {
    tempVertex.fromArray(positions.array, jointAnchorIndex * 3);
    head.localToWorld(tempVertex);
    modelPivot.worldToLocal(tempVertex);
    jointRoot.position.copy(tempVertex).add(jointSnapOffset);
  }

  const alteredTarget = jointSnapped && now - jointSnappedAt >= ALTERED_FACE_DELAY ? 1 : 0;
  const alteredDuration = alteredTarget > alteredFaceOpacity ? ALTERED_FACE_FADE_IN : ALTERED_FACE_FADE_OUT;
  alteredFaceOpacity = THREE.MathUtils.clamp(
    alteredFaceOpacity + Math.sign(alteredTarget - alteredFaceOpacity) * dt / (alteredDuration / 1000),
    0,
    1
  );
  if (Math.abs(alteredTarget - alteredFaceOpacity) < 0.001) alteredFaceOpacity = alteredTarget;
  if (alteredFace) {
    alteredFace.visible = alteredFaceOpacity > 0.001;
    const materials = Array.isArray(alteredFace.material) ? alteredFace.material : [alteredFace.material];
    for (const material of materials) material.opacity = alteredFaceOpacity;
  }

  const smileDuration = alteredTarget > smileAmount ? SMILE_FADE_IN : SMILE_FADE_OUT;
  smileAmount = THREE.MathUtils.clamp(
    smileAmount + Math.sign(alteredTarget - smileAmount) * dt / (smileDuration / 1000),
    0,
    1
  );
  if (Math.abs(alteredTarget - smileAmount) < 0.001) smileAmount = alteredTarget;

  if (modelPivot) {
    const idleStrength = dragging ? 0.25 : 1;
    const followEase = 1 - Math.exp(-3.2 * dt);
    turnAngle = THREE.MathUtils.lerp(turnAngle, effectiveEyeLookTarget.x * 0.384 + idleYaw + motionYaw, followEase);
    headPitch = THREE.MathUtils.lerp(headPitch, -effectiveEyeLookTarget.y * 0.154 + idlePitch + motionPitch, followEase);
    modelPivot.rotation.y = turnAngle + motionKick.y;
    modelPivot.rotation.z = (Math.sin(idleTime * 1.05) * 0.012 + Math.sin(idleTime * 0.43 + 1.8) * 0.005) * idleStrength + idleRoll + motionRoll + motionKick.z;
    modelPivot.rotation.x = headPitch + (Math.sin(idleTime * 0.72 + 0.6) * 0.006) * idleStrength + motionKick.x;
    modelPivot.position.y = 0.080 + Math.sin(idleTime * 0.92) * 0.010 * idleStrength + idleBob;

    // Squashy late-90s blob entrance: rapidly grows in, overshoots, then
    // settles into the normal idle motion without hiding interactivity.
    const entrance = THREE.MathUtils.clamp(entranceTime / 1.65, 0, 1);
    const baseScale = entrance === 1 ? 1 : 1 - Math.exp(-5.2 * entrance) * Math.cos(entrance * Math.PI * 5.5);
    const wobble = entrance === 1 ? 0 : Math.sin(entrance * Math.PI * 7) * (1 - entrance) * 0.22;
    modelPivot.scale.set(
      Math.max(0.01, baseScale * (1 + wobble)),
      Math.max(0.01, baseScale * (1 - wobble * 0.78)),
      Math.max(0.01, baseScale * (1 + wobble * 0.18))
    );
  }

  if (jointSnapped && jointVisual && jointTip) {
    smokedFraction = Math.min(1, smokedFraction + dt * 1000 / JOINT_SMOKE_DURATION);
    const lengthScale = THREE.MathUtils.lerp(1, JOINT_MIN_SCALE_X, smokedFraction);
    // Shrink towards the mouth-contact end, so the attached end never slides.
    jointVisual.scale.x = lengthScale;
    jointVisual.position.x = JOINT_CONTACT_X * (1 - lengthScale);
    if (jointInhaleVisual) {
      jointInhaleVisual.scale.x = lengthScale;
      jointInhaleVisual.position.x = JOINT_CONTACT_X * (1 - lengthScale);
    }
    const liveTipX = JOINT_CONTACT_X + JOINT_FULL_LENGTH * lengthScale;
    jointTip.position.x = liveTipX;

    const inhalePhase = ((now - jointSnappedAt) % INHALE_CYCLE) / INHALE_CYCLE;
    const inhale = inhalePhase < 0.28 ? Math.sin(inhalePhase / 0.28 * Math.PI) : 0;
    if (jointInhaleVisual) jointInhaleVisual.visible = inhale > 0.01;
    for (const material of jointInhaleMaterials) material.opacity = inhale * 0.9;

    // A pull produces a thick cluster at the tip; idle burning stays restrained.
    if (now >= nextSmokeAt && smokedFraction < 0.995) {
      if (inhale > 0.22) {
        emitTerribleSmoke(true);
        if (inhale > 0.62) emitTerribleSmoke(true);
        nextSmokeAt = now + 145 + Math.random() * 80;
      } else {
        emitTerribleSmoke(false);
        nextSmokeAt = now + 720 + Math.random() * 380;
      }
    }
    if (now >= nextNoseExhaleAt) {
      noseExhaleUntil = now + 1800;
      nextNosePuffAt = now;
      nextNoseExhaleAt = now + INHALE_CYCLE;
    }
    if (now < noseExhaleUntil && now >= nextNosePuffAt) {
      emitNoseSmoke(Math.random() < 0.5 ? -1 : 1);
      nextNosePuffAt = now + 230 + Math.random() * 160;
    }
    if (smokedFraction >= 1) spitFinishedJoint(now);
  } else if (jointInhaleMaterials.length) {
    if (jointInhaleVisual) jointInhaleVisual.visible = false;
    for (const material of jointInhaleMaterials) material.opacity = 0;
  }

  if (jointSpitting && jointRoot) {
    jointSpitVelocity.y -= 1.4 * dt;
    jointRoot.position.addScaledVector(jointSpitVelocity, dt);
    jointRoot.rotation.z -= 5.6 * dt;
    jointRoot.rotation.x += 2.2 * dt;
    if (now - jointSpitAt > 1450) retireFinishedJoint();
  }

  let geometryDirty = false;
  if (positions && fullFaceRecoveryAt && now >= fullFaceRecoveryAt && dragMode !== 'face') {
    const recovery = Math.exp(-2.15 * dt);
    let stillRecovering = false;
    for (let i = 0; i < offsets.length; i++) {
      offsets[i] *= recovery;
      velocities[i] = 0;
      if (Math.abs(offsets[i]) < 0.00008) offsets[i] = 0;
      else stillRecovering = true;
      positions.array[i] = rest[i] + offsets[i];
    }
    geometryDirty = true;
    active = [];
    weights = [];
    if (!stillRecovering) fullFaceRecoveryAt = 0;
  }

  if (positions && active.length) {
    let moving = false;
    if (!dragging) {
      const damping = Math.exp(-DAMPING * dt);
      for (let n = 0; n < active.length; n++) {
        const i3 = active[n] * 3;
        for (let axis = 0; axis < 3; axis++) {
          const index = i3 + axis;
          velocities[index] += -offsets[index] * SPRING * dt;
          velocities[index] *= damping;
          offsets[index] += velocities[index] * dt;
          if (Math.abs(offsets[index]) < 0.00008 && Math.abs(velocities[index]) < 0.0008) {
            offsets[index] = 0;
            velocities[index] = 0;
          } else {
            moving = true;
          }
        }
      }
    } else {
      moving = true;
    }

    for (let n = 0; n < active.length; n++) {
      const i3 = active[n] * 3;
      positions.array[i3] = rest[i3] + offsets[i3];
      positions.array[i3 + 1] = rest[i3 + 1] + offsets[i3 + 1];
      positions.array[i3 + 2] = rest[i3 + 2] + offsets[i3 + 2];
    }
    geometryDirty = true;
    if (!moving) {
      active = [];
      weights = [];
    }
  }

  const expressionChanged = Math.abs(smileAmount - lastSmileAmount) > 0.00001
    || Math.abs(blinkAmount - lastBlinkAmount) > 0.00001;
  if (positions && combinedDeformationVertices.length && (geometryDirty || expressionChanged)) {
    for (const vertex of combinedDeformationVertices) {
      const i3 = vertex.index * 3;
      const smileStrength = vertex.smileWeight * smileAmount;
      positions.array[i3] = rest[i3] + offsets[i3]
        + vertex.smileSide * 0.095 * smileStrength;
      positions.array[i3 + 1] = rest[i3 + 1] + offsets[i3 + 1]
        + 0.135 * smileStrength
        - 0.052 * vertex.stonerWeight * smileAmount
        + vertex.blinkTargetY * vertex.blinkWeight * blinkAmount;
      positions.array[i3 + 2] = rest[i3 + 2] + offsets[i3 + 2]
        + 0.016 * smileStrength
        + 0.006 * vertex.stonerWeight * smileAmount
        + 0.006 * vertex.blinkWeight * blinkAmount;
    }
    geometryDirty = true;
  }
  lastSmileAmount = smileAmount;
  lastBlinkAmount = blinkAmount;

  if (positions && geometryDirty) {
    positions.needsUpdate = true;
    const smoothNormalsNow = dragging || active.length > 0 || expressionChanged || blinkAmount > 0;
    normalTimer += dt;
    if (smoothNormalsNow || normalTimer >= 0.066) {
      head.geometry.computeVertexNormals();
      normalTimer = 0;
    }
  }

  eyeLook.lerp(effectiveEyeLookTarget, 1 - Math.exp(-10 * dt));
  for (const eye of pupils) {
    const index = eye.anchor * 3;
    tempVertex.fromArray(positions.array, index);
    eye.group.position.copy(tempVertex);
    eye.group.position.x += eye.offsetX;
    eye.group.position.y += eye.offsetY;
    eye.group.position.z += eye.offsetZ;
    eye.group.quaternion.identity();
    eye.group.visible = blinkAmount < 0.48;
    eye.group.scale.set(eye.size, eye.size * (1 - smileAmount * 0.20), eye.size);
    const headTurnLook = -Math.sin(turnAngle) * 0.020;
    const lookX = THREE.MathUtils.clamp(eyeLook.x * 0.016 + headTurnLook, -0.026, 0.026);
    const lookY = eyeLook.y * 0.007;
    eye.iris.position.set(lookX, lookY, 0);
    eye.pupil.position.set(lookX, lookY, 0.0012);
    eye.highlight.position.set(lookX - 0.0045, lookY + 0.0045, 0.0022);
  }

  renderer.render(scene, camera);
}

function resize() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();
animate();
