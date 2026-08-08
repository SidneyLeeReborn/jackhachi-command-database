import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const stage = document.querySelector('#face-stage');
const canvas = document.querySelector('#face-canvas');
const loading = document.querySelector('#loading');
const resetButton = document.querySelector('#reset');
const smokeLayer = document.querySelector('#smoke-layer');
const duragButton = document.querySelector('#durag-toggle');
const bandanaButton = document.querySelector('#bandana-toggle');
const jointButton = document.querySelector('#joint-toggle');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
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
const pupils = [];

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
const jointSpitVelocity = new THREE.Vector3();
let alteredFace = null;
let alteredFaceOpacity = 0;
let smileAmount = 0;
let lastSmileAmount = 0;
let smileVertices = [];
let stonerVertices = [];
let turnAngle = 0;
let headPitch = 0;
let duragRoot = null;
let duragEquipped = false;
let bandanaRoot = null;
let bandanaEquipped = false;
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

const GRAB_RADIUS = 0.34;
const MAX_PULL = 1.18;
const SPRING = 54;
const DAMPING = 5.8;
const JOINT_SCALE = 7;
const JOINT_LOOSE_POSITION = new THREE.Vector3(-0.56, -0.43, 0.92);
const JOINT_LOOSE_ROTATION = THREE.MathUtils.degToRad(-8);
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

// Mouse placement should feel physical without demanding pixel-perfect contact.
// This is measured from the joint's mouth end to the nearest head vertex.
const JOINT_CONTACT_DISTANCE = 0.32;

const EYE_SPECS = [
  { x: -0.196, y: 0.721, z: 0.395, offsetX: 0.043, offsetY: -0.021, offsetZ: 0.038, size: 1 },
  { x: 0.186, y: 0.723, z: 0.418, offsetX: -0.005, offsetY: -0.012, offsetZ: 0.007, size: 1 }
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

    Promise.all([
      textureLoader.loadAsync('./shaded2.png?v=1'),
      textureLoader.loadAsync('./shaded3.png?v=1')
    ]).then(([normalTexture, alteredTexture]) => {
      for (const texture of [normalTexture, alteredTexture]) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }

      const materials = Array.isArray(head.material) ? head.material : [head.material];
      for (const material of materials) {
        material.map = normalTexture;
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
    jointRoot.rotation.z = JOINT_LOOSE_ROTATION;
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
  prepareGroan();
  clearTimeout(groanTimer);
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
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  if (jointRoot && !jointSpitting) {
    const jointHit = raycaster.intersectObject(jointRoot, true)[0];
    if (jointHit) {
      event.preventDefault();
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
  emitDuragPoof();
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
  emitDuragPoof();
}

function emitDuragPoof() {
  if (!modelPivot) return;
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2;
    const radius = 0.08 + (i % 5) * 0.045;
    const point = new THREE.Vector3(Math.cos(angle) * radius, 0.12 + Math.sin(angle) * radius, 0.72);
    modelPivot.localToWorld(point);
    setTimeout(() => emitSmokeAtWorld(point, true, true, 3.8), i * 18);
  }
}

function toggleJointItem() {
  if (!jointRoot || jointSnapped || jointSpitting) return;
  if (jointRoot.visible && !jointDropping) {
    jointRoot.visible = false;
    jointButton.setAttribute('aria-pressed', 'false');
    return;
  }
  jointRoot.visible = true;
  jointDropping = true;
  jointDropVelocity = 0;
  jointRoot.position.set(JOINT_LOOSE_POSITION.x, 1.65, JOINT_LOOSE_POSITION.z);
  jointRoot.rotation.set(0, 0, JOINT_LOOSE_ROTATION);
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
  if (!jointRoot || !jointContact || !modelPivot || !head || !positions) return;
  const contactWorld = jointContact.getWorldPosition(new THREE.Vector3());
  const targetLocal = head.worldToLocal(contactWorld.clone());
  const mouthLocal = head.worldToLocal(modelPivot.localToWorld(new THREE.Vector3(0, -0.52, 0.52)));
  let nearestDistance = Infinity;
  for (let i = 0; i < positions.count; i++) {
    tempVertex.fromArray(positions.array, i * 3);
    // Only lip/mouth vertices are legal anchors. This prevents the broad
    // contact tolerance from accepting the nose before reaching the mouth.
    if (tempVertex.distanceToSquared(mouthLocal) > 0.22 * 0.22) continue;
    const distance = tempVertex.distanceToSquared(targetLocal);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      jointAnchorIndex = i;
    }
  }
  if (Math.sqrt(nearestDistance) > JOINT_CONTACT_DISTANCE) {
    jointAnchorIndex = null;
    return;
  }

  modelPivot.attach(jointRoot);
  jointRoot.scale.setScalar(JOINT_SCALE);
  const contactInPivot = modelPivot.worldToLocal(contactWorld.clone());
  const contactFromRoot = contactInPivot.sub(jointRoot.position);
  tempVertex.fromArray(positions.array, jointAnchorIndex * 3);
  head.localToWorld(tempVertex);
  surfacePointWorld.copy(tempVertex);
  modelPivot.worldToLocal(tempVertex);
  tempNormal.fromBufferAttribute(head.geometry.attributes.normal, jointAnchorIndex);
  normalMatrix.getNormalMatrix(head.matrixWorld);
  tempNormal.applyNormalMatrix(normalMatrix).normalize();
  surfacePointWorld.add(tempNormal);
  modelPivot.worldToLocal(surfacePointWorld);
  jointSnapOffset.subVectors(surfacePointWorld, tempVertex).normalize().multiplyScalar(0.008).sub(contactFromRoot);
  jointRoot.position.copy(tempVertex).add(jointSnapOffset);
  jointSnapped = true;
  jointSnappedAt = performance.now();
  nextNoseExhaleAt = jointSnappedAt + 6500;
  noseExhaleUntil = 0;
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
  jointSpitAt = now;
  jointSpitVelocity.set(0.48, -0.16, 0.12);
}

function returnFreshJoint() {
  if (!jointRoot || !jointVisual) return;
  scene.attach(jointRoot);
  jointRoot.position.copy(JOINT_LOOSE_POSITION);
  jointRoot.rotation.set(0, 0, JOINT_LOOSE_ROTATION);
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
  jointRoot.visible = true;
  jointButton.setAttribute('aria-pressed', 'true');
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

function emitSmokeAtWorld(worldPoint, fromNose, heavy = false, sizeMultiplier = 1) {
  projectedTip.copy(worldPoint).project(camera);
  if (projectedTip.z < -1 || projectedTip.z > 1) return;
  const puff = document.createElement('span');
  puff.className = `smoke-puff${fromNose ? ' nose-smoke' : ''}`;
  puff.style.left = `${(projectedTip.x * 0.5 + 0.5) * stage.clientWidth}px`;
  puff.style.top = `${(-projectedTip.y * 0.5 + 0.5) * stage.clientHeight}px`;
  const drift = Math.round(Math.random() * (fromNose ? 44 : 70) - (fromNose ? 22 : 35));
  const baseSize = (fromNose ? 30 : heavy ? 31 : 22) + Math.round(Math.random() * 13);
  puff.style.setProperty('--smoke-size', `${baseSize * sizeMultiplier}px`);
  puff.style.setProperty('--smoke-life', `${(fromNose ? 3.5 : 2.8) + Math.random() * 1.25}s`);
  puff.style.setProperty('--smoke-drift', `${drift}px`);
  puff.style.setProperty('--smoke-drift-end', `${drift + Math.round(Math.random() * 50 - 25)}px`);
  puff.style.setProperty('--smoke-turn', `${Math.round(Math.random() * 34 - 17)}deg`);
  puff.style.setProperty('--smoke-turn-end', `${Math.round(Math.random() * 70 - 35)}deg`);
  smokeLayer.append(puff);
  puff.addEventListener('animationend', () => puff.remove(), { once: true });
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

canvas.addEventListener('pointerdown', beginDrag);
canvas.addEventListener('pointermove', moveDrag);
canvas.addEventListener('pointermove', aimEyes);
canvas.addEventListener('pointerleave', () => eyeLookTarget.set(0, 0));
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
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

const clock = new THREE.Clock();
let normalTimer = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const now = performance.now();
  idleTime += dt;
  entranceTime += dt;

  if (jointDropping && jointRoot) {
    jointDropVelocity -= 4.8 * dt;
    jointRoot.position.y += jointDropVelocity * dt;
    jointRoot.rotation.z += 1.8 * dt;
    if (jointRoot.position.y <= JOINT_LOOSE_POSITION.y) {
      jointRoot.position.copy(JOINT_LOOSE_POSITION);
      jointRoot.rotation.set(0, 0, JOINT_LOOSE_ROTATION);
      jointDropping = false;
      jointDropVelocity = 0;
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
    turnAngle = THREE.MathUtils.lerp(turnAngle, eyeLookTarget.x * 0.30, followEase);
    headPitch = THREE.MathUtils.lerp(headPitch, -eyeLookTarget.y * 0.12, followEase);
    modelPivot.rotation.y = turnAngle;
    modelPivot.rotation.z = (Math.sin(idleTime * 1.05) * 0.012 + Math.sin(idleTime * 0.43 + 1.8) * 0.005) * idleStrength;
    modelPivot.rotation.x = headPitch + (Math.sin(idleTime * 0.72 + 0.6) * 0.006) * idleStrength;
    modelPivot.position.y = 0.080 + Math.sin(idleTime * 0.92) * 0.010 * idleStrength;

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
    for (const material of jointInhaleMaterials) material.opacity = 0;
  }

  if (jointSpitting && jointRoot) {
    jointSpitVelocity.y -= 1.4 * dt;
    jointRoot.position.addScaledVector(jointSpitVelocity, dt);
    jointRoot.rotation.z -= 5.6 * dt;
    jointRoot.rotation.x += 2.2 * dt;
    if (now - jointSpitAt > 1450) returnFreshJoint();
  }

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
    positions.needsUpdate = true;
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
    positions.needsUpdate = true;
    normalTimer += dt;
    if (normalTimer > 0.05) {
      head.geometry.computeVertexNormals();
      normalTimer = 0;
    }
    if (!moving) {
      active = [];
      weights = [];
    }
  }

  if (positions && smileVertices.length) {
    for (const vertex of smileVertices) {
      const i3 = vertex.index * 3;
      const strength = vertex.weight * smileAmount;
      positions.array[i3] = rest[i3] + offsets[i3] + vertex.side * 0.095 * strength;
      positions.array[i3 + 1] = rest[i3 + 1] + offsets[i3 + 1] + 0.135 * strength;
      positions.array[i3 + 2] = rest[i3 + 2] + offsets[i3 + 2] + 0.016 * strength;
    }
    positions.needsUpdate = true;
    if (Math.abs(smileAmount - lastSmileAmount) > 0.00001) {
      normalTimer += dt;
      if (normalTimer > 0.05) {
        head.geometry.computeVertexNormals();
        normalTimer = 0;
      }
    }
    lastSmileAmount = smileAmount;
  }


  if (positions && stonerVertices.length) {
    for (const vertex of stonerVertices) {
      const i3 = vertex.index * 3;
      positions.array[i3 + 1] -= 0.052 * vertex.weight * smileAmount;
      positions.array[i3 + 2] += 0.006 * vertex.weight * smileAmount;
    }
    positions.needsUpdate = true;
  }

  eyeLook.lerp(eyeLookTarget, 1 - Math.exp(-10 * dt));
  for (const eye of pupils) {
    const index = eye.anchor * 3;
    tempVertex.fromArray(positions.array, index);
    eye.group.position.copy(tempVertex);
    eye.group.position.x += eye.offsetX;
    eye.group.position.y += eye.offsetY;
    eye.group.position.z += eye.offsetZ;
    eye.group.quaternion.identity();
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
