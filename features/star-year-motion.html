// features/star-year-motion.js
// 「星の年周運動」＝ 地球が公転することで、真夜中に見える星座（太陽と反対方向の星座）が
// 1年かけて少しずつ入れ替わっていく現象を、宇宙視点と地表視点の両方から観察できるようにする機能。
import { createTwinView, LAYERS } from '../common/framework.js';
import * as THREE from 'three';

const EARTH_RADIUS = 2.2;
const EARTH_ORBIT_RADIUS = 60;
const EARTH_ORBIT_PERIOD = 300; // これが「1年」
const TIME_MAX = EARTH_ORBIT_PERIOD;
const STAR_SPHERE_RADIUS = 300; // 「遠くの恒星」を置く半径（演出用。実際の距離とは無関係）

// 4つの季節の代表的な星座を、公転軌道上の角度に固定して配置する
// （地球からその角度の方向を見たとき＝太陽と反対＝真夜中に見える、という設定）
const SEASON_MARKERS = [
  { angleDeg: 0, name: 'オリオン座', season: '冬', color: 0x9fd0ff, shape: 'orion' },
  { angleDeg: 90, name: 'しし座', season: '春', color: 0xffe08a, shape: 'leo' },
  { angleDeg: 180, name: 'さそり座', season: '夏', color: 0xff8a6a, shape: 'scorpius' },
  { angleDeg: 270, name: 'ペガスス座', season: '秋', color: 0xb0a0ff, shape: 'pegasus' },
];

// 各星座の「絵」用の星の並び（0〜1の相対座標）と、星をつなぐ線。
// 実際の星座の形をイメージしやすいように簡略化したもの。
const CONSTELLATION_SHAPES = {
  orion: {
    stars: [
      [0.50, 0.06], // 左肩(ベテルギウス)
      [0.20, 0.16], // 右肩
      [0.36, 0.46], [0.50, 0.50], [0.64, 0.54], // 三ツ星
      [0.24, 0.86], // 右足(リゲル)
      [0.58, 0.92], // 左足
    ],
    edges: [[0, 2], [1, 2], [2, 3], [3, 4], [0, 6], [1, 5], [5, 6]],
  },
  leo: {
    // 頭部の「?」を裏返したような鎌（ししの首〜頭）＋胴体の三角形
    stars: [
      [0.30, 0.10], [0.46, 0.06], [0.58, 0.16], [0.52, 0.30], [0.34, 0.30], [0.26, 0.20],
      [0.34, 0.30], [0.72, 0.40], [0.90, 0.34], [0.86, 0.58], [0.34, 0.30],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [4, 7], [7, 8], [8, 9], [9, 4]],
  },
  scorpius: {
    // S字にカーブする尾を持つさそり
    stars: [
      [0.16, 0.10], [0.24, 0.22], [0.20, 0.36], [0.30, 0.46],
      [0.44, 0.50], [0.58, 0.56], [0.70, 0.50], [0.78, 0.62],
      [0.74, 0.76], [0.62, 0.82],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]],
  },
  pegasus: {
    // 「秋の四辺形」＋首・頭
    stars: [
      [0.24, 0.20], [0.74, 0.18], [0.76, 0.68], [0.26, 0.70],
      [0.10, 0.10], [0.02, 0.02],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5]],
  },
};

let earthOrbitObj, groundAnchor;
let antiSolarLine, antiSolarLineGeo, antiSolarMarker;
let seasonObjects = []; // { angle, mesh, glow, label }

function makeLabelTexture(text, colorHex) {
  const w = 320, h = 100;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(6, 20, w - 12, h - 40, 18); ctx.fill(); }
  else { ctx.fillRect(6, 20, w - 12, h - 40); }
  ctx.font = 'bold 42px "Hiragino Sans","Yu Gothic",sans-serif';
  ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  return new THREE.CanvasTexture(c);
}

// 星座を「点」ではなく、星をつないだ絵（星座絵）として描くテクスチャ。
// 星と星を結ぶ線＋星の輝き＋星座名を1枚の絵にまとめる。
function makeConstellationTexture(shapeKey, colorHex, name) {
  const shape = CONSTELLATION_SHAPES[shapeKey];
  const w = 300, h = 300;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const colorStr = '#' + colorHex.toString(16).padStart(6, '0');
  const pad = 46, drawW = w - pad * 2, drawH = h - pad * 2 - 34;

  ctx.clearRect(0, 0, w, h);

  const pts = shape.stars.map(([x, y]) => [pad + x * drawW, pad + y * drawH]);

  // 星座の線（結び線）
  ctx.strokeStyle = colorStr;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = colorStr;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  shape.edges.forEach(([a, b]) => {
    ctx.moveTo(pts[a][0], pts[a][1]);
    ctx.lineTo(pts[b][0], pts[b][1]);
  });
  ctx.stroke();

  // 星（点）を光る円で描く
  ctx.globalAlpha = 1;
  pts.forEach(([x, y]) => {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 13);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, colorStr);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 星座名（絵の下に表示）
  ctx.shadowBlur = 0;
  ctx.font = 'bold 30px "Hiragino Sans","Yu Gothic",sans-serif';
  ctx.fillStyle = colorStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(name, w / 2, h - 14);

  return new THREE.CanvasTexture(c);
}

createTwinView({
  leftLabel: '🌏 宇宙から見たようす',
  leftSub: '太陽・地球・地球の通り道（軌道）・遠くの星座<br>白い線＝いま「真夜中」に見える方向',
  rightLabel: '🧑‍🚀 地球から見た夜空',
  rightSub: '太陽と反対の方向（真夜中の空）を見ているよ',
  flagText: '🌌 いま真夜中に見えるのは…',
  homeUrl: '../index.html',

  orbitPeriod: EARTH_ORBIT_PERIOD,
  orbitRadius: EARTH_ORBIT_RADIUS,
  timeMax: TIME_MAX,

  stopOrbitLabels: { off: '🛑 地球の動きを止める', on: '▶ 地球の動きを再開' },
  trackButton: {
    offLabel: '🌙 真夜中の方角を追いかける',
    onLabel: '🌙 追いかけ中（押すとやめる）',
    minPitchDeg: 10,
    getDirection: (state) => new THREE.Vector3(Math.cos(state.earthAngle), 0, Math.sin(state.earthAngle)),
  },
  layerToggleButtons: [
    { id: 'seasonLabelBtn', layer: LAYERS.MARKER_A, offLabel: '🌌 星座ラベルを表示', onLabel: '🌌 星座ラベルを隠す' },
  ],

  helpTitle: '🌌 このシミュレーションでわかること',
  helpBodyHTML: `
    <p>地球は太陽のまわりを1年かけて1周（＝<b>公転</b>）しています。夜、太陽と反対の方向の空を見上げると、そこに見える星座は季節によって違います。これを<b>星の年周運動</b>と言います。</p>
    <h3>① なぜ見える星座が変わるの？</h3>
    <p>地球が公転して位置を変えると、「太陽と反対の方向」も少しずつ変わっていきます。真夜中に見える星座は、この「太陽と反対の方向」にある星座なので、地球が公転するにつれて、見える星座がゆっくり入れ替わっていきます。</p>
    <h3>② なぜ毎年同じ季節に同じ星座が見えるの？</h3>
    <p>星（恒星）はとても遠くにあるため、地球から見た方向はほとんど変わりません。地球は毎年同じ軌道を1周するので、「太陽と反対の方向」も毎年同じように移り変わり、結果として同じ季節には同じ星座が見えるのです。</p>
    <h3>🎮 操作のしかた</h3>
    <ul>
      <li>画面をドラッグ（指でなぞる）すると、見る向きを変えられます。</li>
      <li>下の時間バーを動かすと、1年の中の時間を自由に進めたり戻したりできます。</li>
      <li>「地球の動きを止める」を押すと、公転がストップします。</li>
      <li>「真夜中の方角を追いかける」を押すと、いま真夜中に見える方向を自動で見続けられます。</li>
      <li>「星座ラベルを表示」を押すと、地球からの夜空にも星座の名前を映して確認できます。</li>
    </ul>
  `,
  formatTimeLabel: (t) => {
    const yearFrac = (t / EARTH_ORBIT_PERIOD);
    const monthApprox = Math.floor(yearFrac * 12) + 1;
    return `t = ${t.toFixed(1)}　約${monthApprox}か月目（1年で一周）`;
  },

  setup(ctx) {
    const { scene } = ctx;

    earthOrbitObj = new THREE.Object3D();
    scene.add(earthOrbitObj);

    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 1, metalness: 0.0, emissive: 0x03060f, emissiveIntensity: 1 })
    );
    earthMesh.layers.set(LAYERS.SPACE_ONLY);
    earthOrbitObj.add(earthMesh);

    groundAnchor = new THREE.Object3D();
    groundAnchor.position.set(EARTH_RADIUS * 1.02, 0, 0);
    earthOrbitObj.add(groundAnchor);

    // 「いま真夜中に見える方向」を示す線と、その先端のマーカー
    antiSolarLineGeo = new THREE.BufferGeometry();
    antiSolarLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const lineMat = new THREE.LineDashedMaterial({ color: 0xdfe8ff, dashSize: 3, gapSize: 2, transparent: true, opacity: 0.7 });
    antiSolarLine = new THREE.Line(antiSolarLineGeo, lineMat);
    antiSolarLine.layers.set(LAYERS.SPACE_ONLY);
    scene.add(antiSolarLine);

    antiSolarMarker = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTexB, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    antiSolarMarker.scale.set(10, 10, 1);
    antiSolarMarker.layers.set(LAYERS.SPACE_ONLY);
    scene.add(antiSolarMarker);

    // 4つの季節の星座マーカー（遠くに固定）
    seasonObjects = SEASON_MARKERS.map((def) => {
      const angle = THREE.MathUtils.degToRad(def.angleDeg);
      const pos = new THREE.Vector3(Math.cos(angle) * STAR_SPHERE_RADIUS, 0, Math.sin(angle) * STAR_SPHERE_RADIUS);

      // 「点」ではなく、星をつないだ星座の絵をスプライトとして表示する
      const pictureTex = makeConstellationTexture(def.shape, def.color, def.name);
      const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: pictureTex, color: 0xffffff, transparent: true, depthWrite: false }));
      mesh.position.copy(pos);
      mesh.scale.set(30, 30, 1);
      mesh.layers.set(LAYERS.MARKER_A);
      scene.add(mesh);

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTexB, color: def.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(pos);
      glow.scale.set(30, 30, 1);
      glow.layers.set(LAYERS.MARKER_A);
      scene.add(glow);

      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture(`${def.season}：${def.name}`, def.color), transparent: true, depthTest: false }));
      label.position.copy(pos).addScaledVector(new THREE.Vector3(0, 1, 0), 20);
      label.scale.set(26, 8, 1);
      label.layers.set(LAYERS.MARKER_A);
      scene.add(label);

      return { angle, def, mesh, glow, label };
    });
  },

  onFrame(ctx, state) {
    const { scene } = ctx;
    const { earthAngle } = state;

    earthOrbitObj.position.set(Math.cos(earthAngle) * EARTH_ORBIT_RADIUS, 0, Math.sin(earthAngle) * EARTH_ORBIT_RADIUS);

    scene.updateMatrixWorld(true);
    const tmpEarthCenter = new THREE.Vector3();
    const tmpAnchorWorld = new THREE.Vector3();
    const tmpUp = new THREE.Vector3();
    earthOrbitObj.getWorldPosition(tmpEarthCenter);
    groundAnchor.getWorldPosition(tmpAnchorWorld);
    tmpUp.copy(tmpAnchorWorld).sub(tmpEarthCenter).normalize();

    // 「太陽と反対の方向」＝ 地球位置の方向（太陽は原点にいる前提）
    const antiSolarDir = new THREE.Vector3(Math.cos(earthAngle), 0, Math.sin(earthAngle));
    // 星座マーカーと同じ半径（原点から）の位置を線の終点にする
    const lineEnd = antiSolarDir.clone().multiplyScalar(STAR_SPHERE_RADIUS);
    const posAttr = antiSolarLineGeo.attributes.position;
    posAttr.setXYZ(0, tmpEarthCenter.x, tmpEarthCenter.y, tmpEarthCenter.z);
    posAttr.setXYZ(1, lineEnd.x, lineEnd.y, lineEnd.z);
    posAttr.needsUpdate = true;
    antiSolarLine.computeLineDistances();
    antiSolarMarker.position.copy(lineEnd);

    // 一番近い季節マーカーを探して、光らせる・ラベルに使う
    let nearest = null, nearestDiff = Infinity;
    seasonObjects.forEach((s) => {
      let diff = earthAngle - s.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const d = Math.abs(diff);
      const closeness = Math.max(0, 1 - d / (Math.PI / 2)); // 90°以内でだんだん強調
      const pictureSize = 30 * (1 + closeness * 0.9);
      s.mesh.scale.set(pictureSize, pictureSize, 1);
      s.mesh.material.opacity = 0.55 + closeness * 0.45;
      s.glow.material.opacity = 0.35 + closeness * 0.5;
      s.glow.scale.set(30 + closeness * 16, 30 + closeness * 16, 1);
      if (d < nearestDiff) { nearestDiff = d; nearest = s; }
    });

    return {
      anchorPos: tmpAnchorWorld,
      up: tmpUp,
      flagOn: true,
      flagText: nearest ? `🌌 いま真夜中に見えるのは「${nearest.def.season}の星座：${nearest.def.name}」` : '🌌 いま真夜中に見える星座',
    };
  },

  onReset() {
    // このシーンは常時アニメーションのみで、追加のリセット処理は不要
  },
});
