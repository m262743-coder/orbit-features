// features/meteor-shower.js
// 「流星群は、地球が公転によって彗星の塵の帯を毎年ほぼ同じ時期に通過するために起きる」
// ということを、宇宙視点（第三者視点）と地表視点（地球からの空）の両方から観察できるようにする機能。
import { createTwinView, LAYERS } from '../common/framework.js';
import * as THREE from 'three';

const EARTH_RADIUS = 2.2;
const EARTH_ORBIT_RADIUS = 60;
const EARTH_ORBIT_PERIOD = 300;
const EARTH_TILT = 0.409;

const COMET_E = 0.7;
const COMET_A = EARTH_ORBIT_RADIUS / (1 - COMET_E);
const COMET_INCLINATION = 0.22;
const COMET_PERIOD = 900;

const NODE_ANGLE = 0;
const TRIGGER_WINDOW = 0.5;
const TIME_MAX = 900;

function cometOrbitPoint(THREE, theta) {
  const r = (COMET_A * (1 - COMET_E * COMET_E)) / (1 + COMET_E * Math.cos(theta));
  const x = r * Math.cos(theta);
  const z0 = r * Math.sin(theta);
  const y = -z0 * Math.sin(COMET_INCLINATION);
  const z = z0 * Math.cos(COMET_INCLINATION);
  return new THREE.Vector3(x, y, z);
}

let earthOrbitObj, earthSpinObj, groundAnchor;
let cometMesh, dustMat, dustBelt;
let earthHalo;
let nodeMarker, nodeMarkerInner, nodeMarkerGlow;
let meteorPool = [];

function makeLabelTexture(THREE, text) {
  const w = 256, h = 96;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10,8,4,0.55)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(6, 18, w - 12, h - 36, 18); ctx.fill(); }
  else { ctx.fillRect(6, 18, w - 12, h - 36); }
  ctx.font = 'bold 46px "Hiragino Sans","Yu Gothic",sans-serif';
  ctx.fillStyle = '#ffdca8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  return new THREE.CanvasTexture(c);
}

function spawnMeteor(THREE, scene, camPos, up, radiantDir, intensity) {
  const worldRefY = new THREE.Vector3(0, 1, 0);
  const worldRefX = new THREE.Vector3(1, 0, 0);
  const auxRef = Math.abs(radiantDir.y) < 0.9 ? worldRefY : worldRefX;
  const r1 = new THREE.Vector3().crossVectors(radiantDir, auxRef).normalize();
  const r2 = new THREE.Vector3().crossVectors(radiantDir, r1).normalize();

  let meteorDir, sep, az, attempts = 0;
  do {
    sep = THREE.MathUtils.degToRad(4 + Math.random() * 88);
    az = Math.random() * Math.PI * 2;
    meteorDir = new THREE.Vector3()
      .addScaledVector(radiantDir, Math.cos(sep))
      .addScaledVector(r1, Math.cos(az) * Math.sin(sep))
      .addScaledVector(r2, Math.sin(az) * Math.sin(sep))
      .normalize();
    attempts++;
  } while (meteorDir.dot(up) < -0.05 && attempts < 12);

  const perp = new THREE.Vector3()
    .addScaledVector(r1, Math.cos(az))
    .addScaledVector(r2, Math.sin(az))
    .normalize();

  const dist = 250 + Math.random() * 200;
  const start = camPos.clone().addScaledVector(meteorDir, dist);

  const lengthFactor = Math.pow(Math.sin(sep), 1.5);
  const len = 3 + lengthFactor * (58 + intensity * 26);
  const end = start.clone().addScaledVector(perp, len);

  const group = new THREE.Group();
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const colorPick = [0xffffff, 0xbfe9ff, 0xffe3b0][Math.floor(Math.random() * 3)];
  const lineMat = new THREE.LineBasicMaterial({ color: colorPick, transparent: true, opacity: 0.8 });
  const line = new THREE.Line(geo, lineMat);
  line.layers.set(LAYERS.EFFECT);
  group.add(line);

  const headMat = new THREE.SpriteMaterial({
    map: sparkTexRef, color: colorPick, transparent: true, opacity: 0.9 + intensity * 0.1,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const head = new THREE.Sprite(headMat);
  const headScale = (1.6 + lengthFactor * 1.8 + intensity * 1.6);
  head.scale.set(headScale, headScale, 1);
  head.position.copy(start);
  head.layers.set(LAYERS.EFFECT);
  group.add(head);

  scene.add(group);
  meteorPool.push({ line, lineMat, head, headMat, group, life: 0, maxLife: (0.5 + Math.random() * 0.5) * (1 + intensity * 0.4) });
}

function updateMeteors(scene, dt) {
  for (let i = meteorPool.length - 1; i >= 0; i--) {
    const m = meteorPool[i];
    m.life += dt;
    const t = m.life / m.maxLife;
    const fade = Math.max(0, 1 - Math.pow(t, 2.2));
    m.lineMat.opacity = 0.8 * fade;
    m.headMat.opacity = 0.9 * Math.max(0, 1 - t * t);
    if (t >= 1) {
      scene.remove(m.group);
      m.line.geometry.dispose();
      m.lineMat.dispose();
      m.headMat.dispose();
      meteorPool.splice(i, 1);
    }
  }
}

let sparkTexRef = null;
let meteorSpawnTimer = 0;

createTwinView({
  leftLabel: '🌏 宇宙から見たようす',
  leftSub: '太陽・地球・地球の通り道（軌道）・彗星の塵（ちり）の帯<br>橙のドーナツ＝毎年同じ場所を通る「交わる点」',
  rightLabel: '🧑‍🚀 地球から見た空',
  rightSub: '塵の帯に入ると、流れ星がたくさん見えるよ！',
  flagText: '🌠 流星群が見えるよ！',
  homeUrl: '../index.html',

  orbitPeriod: EARTH_ORBIT_PERIOD,
  orbitRadius: EARTH_ORBIT_RADIUS,
  timeMax: TIME_MAX,

  stopOrbitLabels: { off: '🛑 地球の動きを止める', on: '▶ 地球の動きを再開' },
  trackButton: {
    offLabel: '🎯 放射点を追いかける',
    onLabel: '🎯 追いかけ中（押すとやめる）',
    minPitchDeg: 22,
    getDirection: (state) => new THREE.Vector3(-Math.sin(state.earthAngle), 0, Math.cos(state.earthAngle)),
  },
  layerToggleButtons: [
    { id: 'nodeInSkyBtn', layer: LAYERS.MARKER_A, offLabel: '🍩 空に交点を表示', onLabel: '🍩 空の交点を隠す' },
  ],

  helpTitle: '🌠 このシミュレーションでわかること',
  helpBodyHTML: `
    <p>地球は太陽のまわりを1年かけて1周（＝<b>公転</b>）しています。宇宙には、彗星（すいせい）が通ったあとに残した「塵（ちり）の帯」があります。</p>
    <h3>① なぜ流星群が起きるの？</h3>
    <p>地球が公転していく途中で、この塵の帯を通り抜けるときがあります。塵が地球の空気にぶつかって光ることで、たくさんの「流れ星」が見えます。これが<b>流星群</b>です。</p>
    <h3>② なぜ毎年同じ時期に起きるの？</h3>
    <p>地球は毎年同じ通り道（軌道）をぐるっと1周します。塵の帯がある場所（オレンジのドーナツの場所）を、毎年同じタイミングで通過するので、流星群は毎年ほぼ同じ時期に見られるのです。</p>
    <h3>③ 「放射点」ってなに？</h3>
    <p>流星群を空から見ると、1つの点から放射状に流れ星が飛び出してくるように見えます。この点を<b>放射点</b>と呼びます。放射点は、地球が進んでいく向き（公転の進行方向）にあります。</p>
    <h3>🎮 操作のしかた</h3>
    <ul>
      <li>画面をドラッグ（指でなぞる）すると、見る向きを変えられます。</li>
      <li>下の時間バーを動かすと、時間を自由に進めたり戻したりできます。</li>
      <li>「地球の動きを止める」を押すと、公転がストップして流星群も止まります。</li>
      <li>「放射点を追いかける」を押すと、流れ星の出どころを自動で見続けられます。</li>
      <li>「空に交点を表示」を押すと、地球からの空にも交点の目印を映して確認できます。</li>
    </ul>
  `,
  formatTimeLabel: (t) => {
    const orbitsCompleted = Math.floor(t / EARTH_ORBIT_PERIOD);
    return `t = ${t.toFixed(1)}  /  ${(t / EARTH_ORBIT_PERIOD).toFixed(2)} 年目　交点通過: ${orbitsCompleted}回`;
  },

  setup(ctx) {
    const { THREE, scene } = ctx;
    sparkTexRef = ctx.sparkTex;

    // 彗星
    cometMesh = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), new THREE.MeshBasicMaterial({ color: 0xdff6ff }));
    scene.add(cometMesh);
    const cometGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTexB, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    cometGlow.scale.set(9, 9, 1);
    cometMesh.add(cometGlow);

    // 彗星軌道の線
    {
      const pts = [];
      for (let i = 0; i <= 200; i++) {
        const a = -Math.PI + (i / 200) * Math.PI * 2 * 0.999;
        pts.push(cometOrbitPoint(THREE, a));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x66d9ff, transparent: true, opacity: 0.35 });
      scene.add(new THREE.Line(geo, mat));
    }

    // 彗星の塵の帯
    const DUST_COUNT = 1400;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST_COUNT * 3);
    const dustBaseColor = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const theta = (Math.random() - 0.5) * (TRIGGER_WINDOW * 2.4);
      const p = cometOrbitPoint(THREE, theta);
      p.x += (Math.random() - 0.5) * 9;
      p.y += (Math.random() - 0.5) * 6;
      p.z += (Math.random() - 0.5) * 9;
      dustPos[i * 3] = p.x; dustPos[i * 3 + 1] = p.y; dustPos[i * 3 + 2] = p.z;
      const c = 0.55 + Math.random() * 0.3;
      dustBaseColor[i * 3] = c; dustBaseColor[i * 3 + 1] = c * 0.95; dustBaseColor[i * 3 + 2] = c;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustBaseColor, 3));
    dustMat = new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, map: ctx.sparkTex,
    });
    dustBelt = new THREE.Points(dustGeo, dustMat);
    scene.add(dustBelt);

    // 地球の階層構造
    earthOrbitObj = new THREE.Object3D();
    scene.add(earthOrbitObj);
    const earthTiltObj = new THREE.Object3D();
    earthTiltObj.rotation.z = EARTH_TILT;
    earthOrbitObj.add(earthTiltObj);
    earthSpinObj = new THREE.Object3D();
    earthTiltObj.add(earthSpinObj);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 1, metalness: 0.0, emissive: 0x03060f, emissiveIntensity: 1 })
    );
    earthMesh.layers.set(LAYERS.SPACE_ONLY);
    earthSpinObj.add(earthMesh);

    groundAnchor = new THREE.Object3D();
    groundAnchor.position.set(EARTH_RADIUS * 1.02, 0, 0);
    earthSpinObj.add(groundAnchor);

    earthHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTexB, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    earthHalo.scale.set(EARTH_RADIUS * 6, EARTH_RADIUS * 6, 1);
    earthHalo.layers.set(LAYERS.SPACE_ONLY);
    earthOrbitObj.add(earthHalo);

    // 交点マーカー
    const nodeMarkerPos = new THREE.Vector3(Math.cos(NODE_ANGLE) * EARTH_ORBIT_RADIUS, 0, Math.sin(NODE_ANGLE) * EARTH_ORBIT_RADIUS);
    nodeMarker = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.28, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff8a2e, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.2 })
    );
    nodeMarker.position.copy(nodeMarkerPos);
    nodeMarker.rotation.x = Math.PI / 2;
    nodeMarker.layers.set(LAYERS.MARKER_A);
    scene.add(nodeMarker);

    nodeMarkerInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.14, 16, 40),
      new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffb066, emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.2 })
    );
    nodeMarkerInner.position.copy(nodeMarkerPos);
    nodeMarkerInner.rotation.x = Math.PI / 2;
    nodeMarkerInner.layers.set(LAYERS.MARKER_A);
    scene.add(nodeMarkerInner);

    nodeMarkerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTexB, color: 0xffb066, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    nodeMarkerGlow.position.copy(nodeMarkerPos);
    nodeMarkerGlow.scale.set(6.5, 6.5, 1);
    nodeMarkerGlow.layers.set(LAYERS.MARKER_A);
    scene.add(nodeMarkerGlow);

    const nodeLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture(THREE, '交点'), transparent: true, depthTest: false }));
    nodeLabel.position.copy(nodeMarkerPos).addScaledVector(new THREE.Vector3(0, 1, 0), 5.5);
    nodeLabel.scale.set(9, 3.4, 1);
    nodeLabel.layers.set(LAYERS.MARKER_A);
    scene.add(nodeLabel);
  },

  onFrame(ctx, state) {
    const { THREE, scene } = ctx;
    const { dt, t, playing, orbitStopped, earthAngle } = state;

    const cometTheta = (t / COMET_PERIOD) * Math.PI * 2 - Math.PI;
    cometMesh.position.copy(cometOrbitPoint(THREE, cometTheta));

    earthOrbitObj.position.set(Math.cos(earthAngle) * EARTH_ORBIT_RADIUS, 0, Math.sin(earthAngle) * EARTH_ORBIT_RADIUS);

    let diff = earthAngle - NODE_ANGLE;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const inShower = Math.abs(diff) < TRIGGER_WINDOW;
    const rawIntensity = inShower ? 1 - Math.abs(diff) / TRIGGER_WINDOW : 0;
    const intensity = rawIntensity * rawIntensity * (3 - 2 * rawIntensity);

    dustMat.opacity = 0.16 + intensity * 0.32;
    dustMat.size = 1.6 + intensity * 1.6;
    earthHalo.material.opacity = intensity * 0.45;

    nodeMarker.material.emissiveIntensity = 1.2 + intensity * 1.2;
    nodeMarkerInner.material.emissiveIntensity = 1.4 + intensity * 1.4;
    nodeMarkerGlow.material.opacity = 0.55 + intensity * 0.4;
    const nodeScalePulse = 1 + intensity * 0.35;
    nodeMarker.scale.setScalar(nodeScalePulse);
    nodeMarkerInner.scale.setScalar(nodeScalePulse);
    nodeMarker.rotation.z += dt * 0.15;
    nodeMarkerInner.rotation.z -= dt * 0.25;

    scene.updateMatrixWorld(true);
    const tmpEarthCenter = new THREE.Vector3();
    const tmpAnchorWorld = new THREE.Vector3();
    const tmpUp = new THREE.Vector3();
    earthOrbitObj.getWorldPosition(tmpEarthCenter);
    groundAnchor.getWorldPosition(tmpAnchorWorld);
    tmpUp.copy(tmpAnchorWorld).sub(tmpEarthCenter).normalize();

    const orbitMoving = !orbitStopped && playing;
    if (inShower && orbitMoving) {
      meteorSpawnTimer -= dt;
      const interval = 1.1 - intensity * 1.0;
      if (meteorSpawnTimer <= 0) {
        const radiantDir = new THREE.Vector3(-Math.sin(earthAngle), 0, Math.cos(earthAngle));
        const n = 1 + Math.round(intensity * 5);
        for (let i = 0; i < n; i++) spawnMeteor(THREE, scene, tmpAnchorWorld, tmpUp, radiantDir, intensity);
        meteorSpawnTimer = Math.max(0.06, interval);
      }
    }
    updateMeteors(scene, dt);

    return { anchorPos: tmpAnchorWorld, up: tmpUp, flagOn: inShower };
  },

  onReset() {
    meteorPool.forEach((m) => {
      m.line.geometry.dispose(); m.lineMat.dispose(); m.headMat.dispose();
    });
    meteorPool = [];
    meteorSpawnTimer = 0;
  },
});
