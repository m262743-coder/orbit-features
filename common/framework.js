// common/framework.js
// 「地球の公転に関連した現象」シリーズの共通土台。
// 左＝宇宙視点（自由に見回せる第三者視点）、右＝地表視点（地球上のカメラ、ドラッグ/ピンチで見回せる）
// という画面構成、時間スライダー・再生/停止・速度・星のオンオフ・解説パネルなどの
// 共通UIとThree.jsのシーン/カメラ/レンダラーをまとめてセットアップする。
//
// 各機能ページは import { createTwinView, LAYERS } from '../common/framework.js' し、
// createTwinView(config) を呼ぶだけで良い。機能固有のオブジェクト（地球・彗星・星座など）は
// config.setup(ctx) の中で ctx.scene に追加し、毎フレームの物理・演出は config.onFrame(ctx, state) に書く。

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const LAYERS = {
  EFFECT: 1,       // 地表視点だけの一時的な演出（流れ星など）
  FOV_HELPER: 2,    // 宇宙視点だけに見せる、地表カメラの画角コーン
  SPACE_ONLY: 3,    // 宇宙視点だけに見せる立体（地球本体など）
  MARKER_A: 4,      // 切り替え可能な目印レイヤー（機能ごとに用途が変わる）
  MARKER_B: 6,      // 2つ目の切り替え可能な目印レイヤー
  GROUND: 5,        // 地表視点だけの「地面」
};

function makeGlowTexture(inner, outer) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function buildSkeletonDOM(config) {
  document.body.innerHTML = `
    <div id="app">
      <div class="panel" id="panel-left">
        <div class="label">${config.leftLabel}<div class="subtext">${config.leftSub || ''}</div></div>
        <canvas id="canvas-left"></canvas>
        <div id="dragHintLeft" class="dragHint">${config.leftDragHint || '👆 ドラッグして見る向きを変えられるよ'}</div>
      </div>
      <div class="panel" id="panel-right">
        <div class="label">${config.rightLabel}<div class="subtext">${config.rightSub || ''}</div></div>
        ${config.flagText ? `<div id="eventFlag">${config.flagText}</div>` : ''}
        <canvas id="canvas-right"></canvas>
        <div id="dragHintRight" class="dragHint">${config.rightDragHint || '👆 ドラッグして空を見まわそう'}</div>
      </div>
    </div>

    <div id="helpOverlay">
      <div id="helpCard">
        <h2>${config.helpTitle || '解説'}</h2>
        ${config.helpBodyHTML || ''}
        <button id="helpCloseBtn">とじる</button>
      </div>
    </div>

    <div id="controls">
      <div class="controlRow" id="controlRowMain">
        <button id="homeBtn">🏠 機能選択にもどる</button>
        <button id="playBtn">⏸ 一時停止</button>
        <button id="stopOrbitBtn">${config.stopOrbitLabels?.off || '🛑 地球の動きを止める'}</button>
      </div>
      <div class="controlRow">
        <span style="font-size:13px;color:#9db2d6;font-weight:bold;">⏱ 時間</span>
        <input type="range" id="timeSlider" min="0" max="${config.timeMax}" step="0.5" value="0">
        <div id="timeLabel">t = 0</div>
        <div class="speedGroup">
          <span>速さ</span>
          <button class="speedBtn" data-speed="0.5">0.5倍</button>
          <button class="speedBtn active" data-speed="1">1倍</button>
          <button class="speedBtn" data-speed="2">2倍</button>
          <button class="speedBtn" data-speed="4">4倍</button>
        </div>
      </div>
    </div>

    <div id="errorBox"></div>
  `;

  window.addEventListener('error', (e) => {
    const box = document.getElementById('errorBox');
    box.style.display = 'block';
    box.textContent = 'エラーが発生しました:\n' + (e.message || e.error) + '\n' + (e.filename ? (e.filename + ':' + e.lineno) : '');
  });

  const mainRow = document.getElementById('controlRowMain');

  // トラッキング（〇〇を追いかける）ボタン
  let trackBtn = null;
  if (config.trackButton) {
    trackBtn = document.createElement('button');
    trackBtn.id = 'trackBtn';
    trackBtn.textContent = config.trackButton.offLabel;
    mainRow.appendChild(trackBtn);
  }

  // レイヤー切り替えボタン（機能ごとの目印表示など）
  const layerToggleBtns = [];
  (config.layerToggleButtons || []).forEach((def) => {
    const btn = document.createElement('button');
    btn.id = def.id;
    btn.textContent = def.offLabel;
    mainRow.appendChild(btn);
    layerToggleBtns.push({ def, btn, on: false });
  });

  const starBtn = document.createElement('button');
  starBtn.id = 'starBtn';
  starBtn.textContent = '✨ 星を消す';
  mainRow.appendChild(starBtn);

  const resetBtn = document.createElement('button');
  resetBtn.id = 'resetBtn';
  resetBtn.textContent = '🔄 はじめから';
  mainRow.appendChild(resetBtn);

  const helpBtn = document.createElement('button');
  helpBtn.id = 'helpBtn';
  helpBtn.textContent = '❓ 解説を見る';
  mainRow.appendChild(helpBtn);

  return { trackBtn, layerToggleBtns, starBtn, resetBtn, helpBtn };
}

export function createTwinView(config) {
  const dyn = buildSkeletonDOM(config);

  const scene = new THREE.Scene();

  // 星空（共通の背景）
  const starGeo = new THREE.BufferGeometry();
  const starCount = 6000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 1400 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false });
  const starPoints = new THREE.Points(starGeo, starMat);
  scene.add(starPoints);

  const glowTexA = makeGlowTexture('rgba(255,235,180,1)', 'rgba(255,180,60,0)');
  const glowTexB = makeGlowTexture('rgba(210,240,255,1)', 'rgba(140,200,255,0)');
  const sparkTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

  // 太陽（共通）
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(config.sunRadius ?? 8, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdd88 })
  );
  scene.add(sunMesh);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexA, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const sunR = config.sunRadius ?? 8;
  sunGlow.scale.set(sunR * 7, sunR * 7, 1);
  scene.add(sunGlow);
  scene.add(new THREE.PointLight(0xfff4d6, 12, 0, 0));
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  scene.add(new THREE.HemisphereLight(0x6f93c8, 0x0a0e18, 0.7));

  // 地球の公転軌道（線・共通）
  const orbitR = config.orbitRadius ?? 60;
  {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x3a68a8, transparent: true, opacity: 0.5 });
    scene.add(new THREE.LineLoop(geo, mat));
  }

  // 地表視点用の「地面」（共通・不透明な円盤。カメラの足元に追従させる）
  const groundPlane = new THREE.Mesh(
    new THREE.CircleGeometry(22, 48),
    new THREE.MeshStandardMaterial({ color: 0x161f18, roughness: 1, metalness: 0.0 })
  );
  groundPlane.layers.set(LAYERS.GROUND);
  scene.add(groundPlane);

  // レンダラー・カメラ
  const canvasLeft = document.getElementById('canvas-left');
  const canvasRight = document.getElementById('canvas-right');
  const panelLeft = document.getElementById('panel-left');
  const panelRight = document.getElementById('panel-right');

  const rendererLeft = new THREE.WebGLRenderer({ canvas: canvasLeft, antialias: true });
  const rendererRight = new THREE.WebGLRenderer({ canvas: canvasRight, antialias: true });
  [rendererLeft, rendererRight].forEach((r) => {
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.outputColorSpace = THREE.SRGBColorSpace;
  });

  const cameraLeft = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
  cameraLeft.position.set(0, 85, 165);
  const controlsLeft = new OrbitControls(cameraLeft, canvasLeft);
  controlsLeft.target.set(0, 0, 0);
  controlsLeft.enableDamping = true;
  controlsLeft.dampingFactor = 0.08;
  controlsLeft.minDistance = 20;
  controlsLeft.maxDistance = 600;

  const cameraRight = new THREE.PerspectiveCamera(75, 1, 0.03, 3000);
  cameraRight.layers.enable(LAYERS.EFFECT);
  cameraRight.layers.enable(LAYERS.GROUND);

  const fovIndicatorCam = new THREE.PerspectiveCamera(cameraRight.fov, 1, 0.4, 13);
  const fovHelper = new THREE.CameraHelper(fovIndicatorCam);
  fovHelper.layers.set(LAYERS.FOV_HELPER);
  scene.add(fovHelper);
  cameraLeft.layers.enable(LAYERS.FOV_HELPER);
  cameraLeft.layers.enable(LAYERS.SPACE_ONLY);
  cameraLeft.layers.enable(LAYERS.MARKER_A);
  cameraLeft.layers.enable(LAYERS.MARKER_B);

  function resize() {
    const wl = panelLeft.clientWidth, hl = panelLeft.clientHeight;
    rendererLeft.setSize(wl, hl, false);
    cameraLeft.aspect = wl / hl;
    cameraLeft.updateProjectionMatrix();

    const wr = panelRight.clientWidth, hr = panelRight.clientHeight;
    rendererRight.setSize(wr, hr, false);
    cameraRight.aspect = wr / hr;
    cameraRight.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // 地表視点のドラッグ視線操作 + ピンチズーム
  const initialPitch = THREE.MathUtils.degToRad(config.initialPitchDeg ?? 23);
  let yaw = 0, pitch = initialPitch;
  let dragging = false, lastX = 0, lastY = 0;
  let trackingActive = false;

  const dragHintLeft = document.getElementById('dragHintLeft');
  const dragHintRight = document.getElementById('dragHintRight');
  canvasLeft.addEventListener('pointerdown', () => dragHintLeft.classList.add('hide'), { once: true });
  canvasRight.addEventListener('pointerdown', () => dragHintRight.classList.add('hide'), { once: true });
  setTimeout(() => { dragHintLeft.classList.add('hide'); dragHintRight.classList.add('hide'); }, 7000);

  canvasRight.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvasRight.setPointerCapture(e.pointerId); });
  canvasRight.addEventListener('pointerup', () => { dragging = false; });
  canvasRight.addEventListener('pointerleave', () => { dragging = false; });
  canvasRight.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    yaw -= dx * 0.0035;
    pitch -= dy * 0.0035;
    pitch = Math.max(-0.15, Math.min(1.4, pitch));
    if (trackingActive && dyn.trackBtn) {
      trackingActive = false;
      dyn.trackBtn.textContent = config.trackButton.offLabel;
      dyn.trackBtn.classList.remove('active');
    }
  });
  canvasRight.addEventListener('wheel', (e) => {
    e.preventDefault();
    cameraRight.fov = Math.max(35, Math.min(100, cameraRight.fov + e.deltaY * 0.03));
    cameraRight.updateProjectionMatrix();
  }, { passive: false });

  let pinchStartDist = null, pinchStartFov = 75;
  function touchDist(t0, t1) { return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY); }
  canvasRight.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { pinchStartDist = touchDist(e.touches[0], e.touches[1]); pinchStartFov = cameraRight.fov; }
  }, { passive: true });
  canvasRight.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist) {
      const d = touchDist(e.touches[0], e.touches[1]);
      cameraRight.fov = Math.max(35, Math.min(100, pinchStartFov * (pinchStartDist / d)));
      cameraRight.updateProjectionMatrix();
    }
  }, { passive: true });
  canvasRight.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinchStartDist = null; }, { passive: true });

  // UI状態
  const timeSlider = document.getElementById('timeSlider');
  const timeLabel = document.getElementById('timeLabel');
  const playBtn = document.getElementById('playBtn');
  const stopOrbitBtn = document.getElementById('stopOrbitBtn');
  const helpBtn = document.getElementById('helpBtn');
  const helpCloseBtn = document.getElementById('helpCloseBtn');
  const helpOverlay = document.getElementById('helpOverlay');
  const homeBtn = document.getElementById('homeBtn');
  const eventFlag = document.getElementById('eventFlag');
  const speedBtns = Array.from(document.querySelectorAll('.speedBtn'));

  let t = 0;
  let playing = true;
  let orbitStopped = false;
  let earthAngleFrozen = 0;
  let speedMul = 1;

  homeBtn.addEventListener('click', () => { window.location.href = config.homeUrl || '../index.html'; });
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ 一時停止' : '▶ 再生する';
  });
  stopOrbitBtn.addEventListener('click', () => {
    orbitStopped = !orbitStopped;
    stopOrbitBtn.textContent = orbitStopped
      ? (config.stopOrbitLabels?.on || '▶ 地球の動きを再開')
      : (config.stopOrbitLabels?.off || '🛑 地球の動きを止める');
    stopOrbitBtn.classList.toggle('active', orbitStopped);
  });
  dyn.starBtn.addEventListener('click', () => {
    starPoints.visible = !starPoints.visible;
    dyn.starBtn.textContent = starPoints.visible ? '✨ 星を消す' : '✨ 星を出す';
    dyn.starBtn.classList.toggle('active', !starPoints.visible);
  });
  if (dyn.trackBtn) {
    dyn.trackBtn.addEventListener('click', () => {
      trackingActive = !trackingActive;
      dyn.trackBtn.textContent = trackingActive ? config.trackButton.onLabel : config.trackButton.offLabel;
      dyn.trackBtn.classList.toggle('active', trackingActive);
    });
  }
  dyn.layerToggleBtns.forEach((entry) => {
    entry.btn.addEventListener('click', () => {
      entry.on = !entry.on;
      if (entry.on) cameraRight.layers.enable(entry.def.layer); else cameraRight.layers.disable(entry.def.layer);
      entry.btn.textContent = entry.on ? entry.def.onLabel : entry.def.offLabel;
      entry.btn.classList.toggle('active', entry.on);
    });
  });
  helpBtn.addEventListener('click', () => helpOverlay.classList.add('show'));
  helpCloseBtn.addEventListener('click', () => helpOverlay.classList.remove('show'));
  helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) helpOverlay.classList.remove('show'); });
  speedBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      speedMul = parseFloat(btn.dataset.speed);
      speedBtns.forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  timeSlider.addEventListener('input', () => { t = parseFloat(timeSlider.value); });

  dyn.resetBtn.addEventListener('click', () => {
    t = 0; timeSlider.value = 0;
    playing = true; playBtn.textContent = '⏸ 一時停止';
    orbitStopped = false;
    stopOrbitBtn.textContent = config.stopOrbitLabels?.off || '🛑 地球の動きを止める';
    stopOrbitBtn.classList.remove('active');
    if (dyn.trackBtn) {
      trackingActive = false;
      dyn.trackBtn.textContent = config.trackButton.offLabel;
      dyn.trackBtn.classList.remove('active');
    }
    dyn.layerToggleBtns.forEach((entry) => {
      entry.on = false;
      cameraRight.layers.disable(entry.def.layer);
      entry.btn.textContent = entry.def.offLabel;
      entry.btn.classList.remove('active');
    });
    starPoints.visible = true;
    dyn.starBtn.textContent = '✨ 星を消す';
    dyn.starBtn.classList.remove('active');
    yaw = 0; pitch = initialPitch;
    speedMul = 1;
    speedBtns.forEach((b) => b.classList.toggle('active', b.dataset.speed === '1'));
    if (config.onReset) config.onReset();
  });

  if (config.autoShowHelp !== false) helpOverlay.classList.add('show');

  function getEarthAngle() {
    if (orbitStopped) return earthAngleFrozen;
    earthAngleFrozen = (t / config.orbitPeriod) * Math.PI * 2;
    return earthAngleFrozen;
  }

  const ctx = {
    THREE, scene, LAYERS,
    cameraLeft, cameraRight, controlsLeft,
    glowTexA, glowTexB, sparkTex,
    orbitRadius: orbitR,
  };

  if (config.setup) config.setup(ctx);

  // メインループ用の一時ベクトル
  const worldRefY = new THREE.Vector3(0, 1, 0);
  const worldRefX = new THREE.Vector3(1, 0, 0);
  const groundPlaneNormal = new THREE.Vector3(0, 0, 1);
  const groundPlaneQuat = new THREE.Quaternion();
  const tmpEast = new THREE.Vector3();
  const tmpNorth = new THREE.Vector3();

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (playing) {
      t += dt * (config.timeSpeedBase ?? 26) * speedMul;
      if (t > config.timeMax) t -= config.timeMax;
      if (t < 0) t += config.timeMax;
      timeSlider.value = t;
    }
    const earthAngle = getEarthAngle();

    if (config.formatTimeLabel) {
      timeLabel.textContent = config.formatTimeLabel(t, config.orbitPeriod);
    } else {
      timeLabel.textContent = `t = ${t.toFixed(1)}  /  ${(t / config.orbitPeriod).toFixed(2)} 年目`;
    }

    const state = { t, dt, playing, speedMul, orbitStopped, earthAngle };
    const result = config.onFrame ? config.onFrame(ctx, state) : null;

    if (result && result.anchorPos && result.up) {
      const up = result.up;
      const east = tmpEast, north = tmpNorth;
      const ref = Math.abs(up.y) < 0.9 ? worldRefY : worldRefX;
      east.crossVectors(ref, up).normalize();
      north.crossVectors(up, east).normalize();

      if (trackingActive && config.trackButton) {
        const dir = config.trackButton.getDirection(state);
        if (dir) {
          const radYaw = Math.atan2(dir.dot(east), dir.dot(north));
          const radPitch = Math.asin(THREE.MathUtils.clamp(dir.dot(up), -1, 1));
          yaw = radYaw;
          pitch = Math.max(radPitch, THREE.MathUtils.degToRad(config.trackButton.minPitchDeg ?? 22));
        }
      }

      cameraRight.position.copy(result.anchorPos);
      const viewDir = new THREE.Vector3()
        .addScaledVector(north, Math.cos(yaw) * Math.cos(pitch))
        .addScaledVector(east, Math.sin(yaw) * Math.cos(pitch))
        .addScaledVector(up, Math.sin(pitch));
      cameraRight.up.copy(up);
      cameraRight.lookAt(result.anchorPos.clone().add(viewDir));

      groundPlane.position.copy(result.anchorPos).addScaledVector(up, -0.15);
      groundPlaneQuat.setFromUnitVectors(groundPlaneNormal, up);
      groundPlane.quaternion.copy(groundPlaneQuat);

      fovIndicatorCam.position.copy(cameraRight.position);
      fovIndicatorCam.quaternion.copy(cameraRight.quaternion);
      fovIndicatorCam.fov = cameraRight.fov;
      fovIndicatorCam.updateProjectionMatrix();
      fovIndicatorCam.updateMatrixWorld(true);
      fovHelper.update();
    }

    if (eventFlag) {
      eventFlag.classList.toggle('show', !!(result && result.flagOn));
      if (result && result.flagText) eventFlag.textContent = result.flagText;
    }

    controlsLeft.update();
    rendererLeft.render(scene, cameraLeft);
    rendererRight.render(scene, cameraRight);
  }

  scene.updateMatrixWorld(true);
  animate();

  return ctx;
}
