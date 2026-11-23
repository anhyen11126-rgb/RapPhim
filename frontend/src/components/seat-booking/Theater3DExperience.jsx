import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Armchair, Box, Map as MapIcon, Maximize, Minimize, Monitor, MoveHorizontal, RotateCw } from 'lucide-react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { seatEyePosition } from './seatLayout';
import './theater3D.css';

const themes = {
  IMAX: {
    title: 'IMAX® LASER', standard: '#23d8ff', vip: '#c879ff',
    screen: { tagline: 'MÀN HÌNH CONG KHỔ LỚN · CÔNG NGHỆ LASER 4K', base: '#091d48', light: '#56ddff', accent: '#ed61ff' },
  },
  ATMOS: {
    title: 'DOLBY ATMOS®', standard: '#ad9bff', vip: '#38d9fc',
    screen: { tagline: 'ÂM THANH VÒM 360° · KHÔNG GIAN ĐIỆN ẢNH ĐA CHIỀU', base: '#22144b', light: '#c1a4ff', accent: '#5ae8ff' },
  },
  GOLD: {
    title: 'GOLD CLASS', standard: '#ffbf66', vip: '#ffe5a4',
    screen: { tagline: 'GHẾ RECLINER · TRẢI NGHIỆM ĐIỆN ẢNH CAO CẤP', base: '#312037', light: '#ffe5ad', accent: '#ffa36f' },
  },
};
const screenCenter = new THREE.Vector3(0, 4.45, -14.5);

function createCinemaScreenTexture({ title, screen: { tagline, base, light, accent } }) {
  const canvas = document.createElement('canvas');
  const width = canvas.width = 2048;
  const height = canvas.height = 864;
  const ctx = canvas.getContext('2d');
  const center = width / 2;

  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, '#030515');
  background.addColorStop(0.66, base);
  background.addColorStop(1, '#040616');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  function glow(x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color + 'cf');
    gradient.addColorStop(0.2, color + '48');
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  for (const [x, y, color] of [[218, 426, accent], [1815, 286, light]]) {
    glow(x, y, 465, color);
    glow(x, y, 85, color);
    const flare = ctx.createLinearGradient(x - 122, y, x + 122, y);
    flare.addColorStop(0, color + '00');
    flare.addColorStop(0.5, '#fff');
    flare.addColorStop(1, color + '00');
    ctx.fillStyle = flare;
    ctx.fillRect(x - 122, y - 1, 244, 2);
  }

  for (let i = 0; i < 1050; i++) {
    const x = ((i * 0.61803398875) % 1) * width;
    const y = ((i * 0.75487766625) % 1) * height;
    ctx.globalAlpha = 0.16 + (i % 17) / 26;
    ctx.fillStyle = i % 7 === 0 ? accent : '#e5efff';
    const size = i % 29 === 0 ? 2.9 : 1.4;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;

  glow(center, 784, 675, light);
  ctx.beginPath();
  ctx.moveTo(0, 820);
  ctx.quadraticCurveTo(center, 510, width, 820);
  const horizon = ctx.createLinearGradient(0, 0, width, 0);
  horizon.addColorStop(0, accent + '00');
  horizon.addColorStop(0.24, accent);
  horizon.addColorStop(0.5, '#f2fbff');
  horizon.addColorStop(0.78, light);
  horizon.addColorStop(1, light + '00');

  ctx.shadowBlur = 34;
  ctx.shadowColor = light;
  ctx.strokeStyle = horizon;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  glow(center, 898, 500, accent);
  for (let i = 0; i < 32; i++) {
    const x = ((i * 0.61803398875) % 1) * width;
    ctx.beginPath();
    ctx.moveTo(center + (x - center) * 0.35, 652);
    ctx.bezierCurveTo(x - 155, 756, x + 155, 773, x, 902);
    ctx.strokeStyle = (i % 3 === 0 ? light : accent) + '65';
    ctx.lineWidth = 1 + i % 4;
    ctx.stroke();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2f6ff';
  ctx.font = '800 52px Arial, sans-serif';
  ctx.fillText('D’AVENOR', center, 183);
  ctx.fillStyle = '#d0def5';
  ctx.font = '600 22px Arial, sans-serif';
  ctx.letterSpacing = '9px';
  ctx.fillText('CINEMA', center, 230);

  ctx.letterSpacing = '5px';
  ctx.font = (title.startsWith('IMAX') ? 'italic ' : '') + '900 139px Arial, sans-serif';
  const titleWidth = ctx.measureText(title).width;
  const titleColor = ctx.createLinearGradient(center - titleWidth / 2, 0, center + titleWidth / 2, 0);
  titleColor.addColorStop(0, light);
  titleColor.addColorStop(0.43, '#f6f8ff');
  titleColor.addColorStop(0.7, accent);
  titleColor.addColorStop(1, accent);
  ctx.fillStyle = titleColor;
  ctx.shadowBlur = 20;
  ctx.shadowColor = base;
  ctx.fillText(title, center, 402, 1580);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#dbe9ff';
  ctx.font = '700 35px Arial, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(tagline, center, 524, 1520);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function buildAuditorium(scene, rows, theme) {
  const floor = new THREE.MeshStandardMaterial({ color: '#191d36', roughness: 0.86 });
  const wall = new THREE.MeshStandardMaterial({ color: '#13172b', emissive: '#0b1020', roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: '#20213a', roughness: 0.6 });
  const cyan = new THREE.MeshBasicMaterial({ color: theme.standard });
  const violet = new THREE.MeshBasicMaterial({ color: theme.vip });
  const allSeats = rows.flatMap(({ left, right }) => [...left, ...right]);
  const halfWidth = Math.max(8.7, ...allSeats.map(({ x, width }) => Math.abs(x) + width / 2 + 1.5));
  const first = rows[0];
  const last = rows.at(-1);
  const rear = last.front + last.depth + 3.4;
  const ceiling = Math.max(9.4, last.y + 4.3);

  function box(material, width, height, depth, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  scene.background = new THREE.Color('#0a1022');
  scene.add(new THREE.HemisphereLight('#d5e3ff', '#68518d', 1.9));
  const fill = new THREE.DirectionalLight('#b0dfff', 1.8);
  fill.position.set(-5, 8, -8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight('#d9a1ff', 2);
  rim.position.set(5, 9, rear);
  scene.add(rim);

  const screen = new THREE.PlaneGeometry(halfWidth * 1.82, 6.8, 48, 1);
  const points = screen.attributes.position;
  for (let i = 0; i < points.count; i++) {
    points.setZ(i, (points.getX(i) / halfWidth) ** 2 * 1.15);
  }
  const projection = new THREE.Mesh(screen, new THREE.MeshBasicMaterial({
    map: createCinemaScreenTexture(theme), toneMapped: false,
  }));
  projection.position.copy(screenCenter);
  scene.add(projection);

  const front = -15;
  const roomDepth = rear - front;
  box(floor, halfWidth * 2, 0.2, roomDepth, 0, -0.1, (front + rear) / 2);
  box(wall, halfWidth * 2, 0.2, roomDepth, 0, ceiling, (front + rear) / 2);
  box(wall, halfWidth * 2, ceiling, 0.2, 0, ceiling / 2, front);
  box(wall, halfWidth * 2, ceiling, 0.2, 0, ceiling / 2, rear);
  for (const side of [-1, 1]) {
    const accent = side === -1 ? cyan : violet;
    box(wall, 0.2, ceiling, roomDepth, side * halfWidth, ceiling / 2, (front + rear) / 2);
    box(accent, 0.035, 0.035, roomDepth - 0.4, side * (halfWidth - 0.14), ceiling - 0.37, (front + rear) / 2);
    for (let z = front + 2; z < rear - 0.6; z += 2.5) {
      box(trim, 0.12, ceiling * 0.6, 2.2, side * (halfWidth - 0.14), ceiling * 0.56, z);
      box(accent, 0.04, ceiling * 0.42, 0.026, side * (halfWidth - 0.22), ceiling * 0.58, z - 0.9);
    }
  }
  for (let z = front + 1.5; z < rear; z += 2.5) {
    box(trim, halfWidth * 2, 0.14, 0.22, 0, ceiling - 0.12, z);
    for (const x of [-halfWidth * 0.52, 0, halfWidth * 0.52]) {
      box(violet, 0.16, 0.04, 0.25, x, ceiling - 0.22, z);
    }
  }

  function platform(start, end, y) {
    box(floor, halfWidth * 2, y, end - start, 0, y / 2, (start + end) / 2);
  }

  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    if (row.crossAisle) platform(previous.front + previous.depth, row.front, previous.y);
    platform(row.front, row.front + row.depth, row.y);
    const accent = row.crossAisle ? violet : cyan;
    for (const x of [0, -halfWidth + 0.52, halfWidth - 0.52]) {
      box(accent, x === 0 ? 1.6 : 0.85, 0.026, 0.035, x, row.y - 0.024, row.front - 0.01);
    }
    if (row.crossAisle) box(violet, halfWidth * 2 - 0.3, 0.037, 0.04, 0, row.y - 0.05, row.front - 0.01);
  });
  platform(last.front + last.depth, rear, last.y);

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  const shadowGradient = shadowContext.createRadialGradient(32, 32, 6, 32, 32, 32);
  shadowGradient.addColorStop(0, '#000b');
  shadowGradient.addColorStop(1, '#0000');
  shadowContext.fillStyle = shadowGradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false,
  });
  const cupHolder = new THREE.TorusGeometry(0.037, 0.009, 8, 16);
  const chairs = new Map();
  const geometries = new Map();
  const seatPiping = new Map();
  const upholstery = {
    STANDARD: new THREE.MeshStandardMaterial({ color: '#10233b', roughness: 0.72 }),
    VIP: new THREE.MeshStandardMaterial({ color: '#251637', roughness: 0.52 }),
    SWEETBOX: new THREE.MeshStandardMaterial({ color: '#301a40', roughness: 0.45 }),
  };
  function rounded(group, material, width, height, depth, radius, x, y, z) {
    const key = [width, height, depth, radius].join('/');
    if (!geometries.has(key)) geometries.set(key, new RoundedBoxGeometry(width, height, depth, 2, radius));
    const mesh = new THREE.Mesh(geometries.get(key), material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  for (const seat of allSeats) {
    const { id, x, y, z, width, type, seatNumber } = seat;
    const premium = type !== 'STANDARD';
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData.seatId = id;
    scene.add(group);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    shadow.scale.set(width * 1.16, 1.2, 1);
    group.add(shadow);
    const color = premium ? theme.vip : theme.standard;
    const glow = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const fabric = upholstery[type] ?? upholstery.STANDARD;
    rounded(group, trim, width * 0.62, 0.38, 0.55, 0.07, 0, 0.19, 0);
    rounded(group, fabric, width - 0.18, 0.19, 0.73, 0.09, 0, 0.41, -0.12);
    const backHeight = premium ? 0.72 : 0.64;
    const backWidth = width - 0.16;
    const back = rounded(group, fabric, backWidth, backHeight, 0.23, 0.095, 0, 0.73, 0.29);
    const pipingKey = [backWidth, backHeight].join('/');
    if (!seatPiping.has(pipingKey)) {
      const outline = new THREE.Shape();
      const halfX = backWidth / 2 - 0.014;
      const halfY = backHeight / 2 - 0.014;
      const corner = 0.095;
      outline.moveTo(-halfX + corner, -halfY);
      outline.lineTo(halfX - corner, -halfY);
      outline.quadraticCurveTo(halfX, -halfY, halfX, -halfY + corner);
      outline.lineTo(halfX, halfY - corner);
      outline.quadraticCurveTo(halfX, halfY, halfX - corner, halfY);
      outline.lineTo(-halfX + corner, halfY);
      outline.quadraticCurveTo(-halfX, halfY, -halfX, halfY - corner);
      outline.lineTo(-halfX, -halfY + corner);
      outline.quadraticCurveTo(-halfX, -halfY, -halfX + corner, -halfY);
      const points = outline.getPoints(5);
      points.pop();
      const path = new THREE.CatmullRomCurve3(points.map(({ x, y }) => new THREE.Vector3(x, y, 0.08)), true, 'centripetal');
      seatPiping.set(pipingKey, new THREE.TubeGeometry(path, 72, 0.012, 5, true));
    }
    const piping = new THREE.Mesh(seatPiping.get(pipingKey), glow);
    piping.position.copy(back.position);
    back.rotation.x = piping.rotation.x = 0.12;
    group.add(piping);
    for (const side of [-1, 1]) {
      const armX = side * (width / 2 - 0.07);
      rounded(group, trim, 0.14, 0.48, 0.75, 0.06, armX, 0.26, -0.08);
      rounded(group, fabric, 0.15, 0.09, 0.71, 0.045, armX, 0.53, -0.08);
      const cup = new THREE.Mesh(cupHolder, trim);
      cup.rotation.x = -Math.PI / 2;
      cup.position.set(armX, 0.578, -0.30);
      group.add(cup);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const paintLabel = (selected) => {
      ctx.clearRect(0, 0, 128, 64);
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#f5efff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(selected ? '✓ ' + seatNumber : seatNumber, 64, 32);
    };
    paintLabel(false);
    const label = new THREE.CanvasTexture(canvas);
    const number = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), new THREE.MeshBasicMaterial({
      map: label, transparent: true, depthWrite: false,
    }));
    number.position.set(0, 0.92, 0.437);
    group.add(number);
    chairs.set(id, { group, glow, color, label, paintLabel, seat });
  }

  return {
    chairs, allSeats,
    overview: new THREE.Vector3(0, Math.min(ceiling - 0.55, last.y + 2.8), rear - 0.24),
    overviewTarget: new THREE.Vector3(0, (screenCenter.y + first.y) / 2, -8),
  };
}

const panel = 'theater-panel';
const formatMoney = (total) => total.toLocaleString('vi-VN') + 'đ';

export default function Theater3DExperience({
  roomType, roomId, showtimeId, rows, initialSeatId, bookedSeats, selectedSeats, total,
  onSeatClick, onConfirm, onClose,
}) {
  const shell = useRef(null);
  const mount = useRef(null);
  const theater = useRef(null);
  const [viewingId, setViewingId] = useState(initialSeatId ?? rows[0]?.left[0]?.id ?? rows[0]?.right[0]?.id);
  const [mode, setMode] = useState(initialSeatId ? 'seat' : 'overview');
  const [freeLook, setFreeLook] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [failure, setFailure] = useState('');
  const theme = themes[roomType] ?? themes.IMAX;
  const viewing = rows.flatMap(({ left, right }) => [...left, ...right]).find(({ id }) => id === viewingId);

  useEffect(() => {
    const element = mount.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailure('Thiết bị không mở được chế độ 3D.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Phòng chiếu 3D. Dùng các phím mũi tên để xoay.');
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const auditorium = buildAuditorium(scene, rows, theme);
    const camera = new THREE.PerspectiveCamera(56, 1, 0.035, 100);
    const direction = new THREE.Vector3();
    const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    let seated = false;
    let allowLook = true;
    let frame = 0;
    let drag = null;

    const render = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
      });
    };
    const resize = () => {
      camera.aspect = Math.max(1, element.clientWidth) / Math.max(1, element.clientHeight);
      camera.fov = seated ? 66 : THREE.MathUtils.clamp(
        THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(0.48) / camera.aspect)), 52, 89,
      );
      camera.updateProjectionMatrix();
      renderer.setSize(element.clientWidth, element.clientHeight);
      render();
    };
    const face = (target) => {
      camera.lookAt(target);
      render();
    };
    const positionCamera = (mode, id) => {
      const chair = auditorium.chairs.get(id);
      seated = mode === 'seat' && Boolean(chair);
      if (seated) {
        camera.position.fromArray(seatEyePosition(chair.seat));
        face(screenCenter);
      } else {
        camera.position.copy(auditorium.overview);
        face(auditorium.overviewTarget);
      }
      resize();
    };
    theater.current = {
      ...auditorium, positionCamera, render, faceScreen: () => face(screenCenter),
      setFreeLook: (enabled) => { allowLook = enabled; },
    };
    positionCamera(initialSeatId ? 'seat' : 'overview', initialSeatId);

    const look = (dx, dy) => {
      if (!allowLook) return;
      rotation.setFromQuaternion(camera.quaternion);
      rotation.y -= dx * 0.005;
      rotation.x = THREE.MathUtils.clamp(rotation.x - dy * 0.005, -1.53, 1.53);
      camera.quaternion.setFromEuler(rotation);
      render();
    };
    const pointerDown = (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, moved: false };
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event) => {
      if (!drag || !event.isPrimary) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag = { x: event.clientX, y: event.clientY, moved: true };
      look(dx, dy);
    };
    const raycaster = new THREE.Raycaster();
    const pointerUp = (event) => {
      if (!drag || !event.isPrimary) return;
      const { moved } = drag;
      drag = null;
      if (moved) return;
      const rect = renderer.domElement.getBoundingClientRect();
      direction.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height, 0);
      raycaster.setFromCamera(direction, camera);
      const hit = raycaster.intersectObjects(scene.children, true)[0];
      const id = hit?.object.parent.userData.seatId;
      if (id) {
        setViewingId(id);
        if (seated) positionCamera('seat', id);
      }
    };
    const pointerCancel = () => { drag = null; };
    const keyboard = (event) => {
      const offsets = { ArrowLeft: [-22, 0], ArrowRight: [22, 0], ArrowUp: [0, -22], ArrowDown: [0, 22] };
      if (offsets[event.key]) {
        event.preventDefault();
        look(...offsets[event.key]);
      }
    };
    const contextLost = (event) => {
      event.preventDefault();
      setFailure('Kết nối đồ họa bị gián đoạn.');
    };
    const contextRestored = () => {
      setFailure('');
      render();
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);
    canvas.addEventListener('lostpointercapture', pointerCancel);
    canvas.addEventListener('keydown', keyboard);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      theater.current = null;
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => {
        material.map?.dispose();
        material.dispose();
      });
      canvas.remove();
      renderer.dispose();
    };
  }, [rows, theme, initialSeatId]);

  useEffect(() => {
    if (!theater.current) return;
    theater.current.setFreeLook(freeLook);
    for (const [id, chair] of theater.current.chairs) {
      const code = chair.seat.seatNumber;
      const selected = selectedSeats.includes(code);
      chair.glow.color.set(selected || id === viewingId ? '#f7f0ff' : bookedSeats.includes(code) ? '#4a506b' : chair.color);
      chair.paintLabel(selected);
      chair.label.needsUpdate = true;
    }
    theater.current.render();
  }, [rows, theme, initialSeatId, viewingId, bookedSeats, selectedSeats, freeLook]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const showSeat = (id = viewingId) => {
    setViewingId(id);
    setMode('seat');
    theater.current?.positionCamera('seat', id);
  };
  const tour = () => {
    setMode('overview');
    theater.current?.positionCamera('overview');
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === shell.current) await document.exitFullscreen();
      else if (shell.current.requestFullscreen) await shell.current.requestFullscreen();
      else setFullscreen((active) => !active);
    } catch {
      setFullscreen((active) => !active);
    }
  };
  const selected = viewing && selectedSeats.includes(viewing.seatNumber);
  const booked = viewing && bookedSeats.includes(viewing.seatNumber);
  const controls = [
    [Armchair, 'Ngồi thử', () => showSeat(), mode === 'seat'],
    [Monitor, 'Nhìn về màn hình', () => theater.current?.faceScreen()],
    [RotateCw, 'Xoay tự do 360°', () => setFreeLook((active) => !active), freeLook],
    [MapIcon, 'Tham quan rạp', tour, mode === 'overview'],
    [MoveHorizontal, 'Xem ghế khác', onClose],
    [fullscreen ? Minimize : Maximize, fullscreen ? 'Thu nhỏ' : 'Toàn màn hình', toggleFullscreen, fullscreen],
  ];
  return (
    <section ref={shell} className={`theater-shell ${fullscreen ? 'theater-expanded' : ''}`}
      data-room-id={roomId} data-showtime-id={showtimeId} data-seat-id={viewing?.id}>
      <aside className={`${panel} theater-summary`}>
        <button type="button" className="theater-back" onClick={onClose}><ArrowLeft size={17} /> Chọn ghế</button>
        <h2>{theme.title}</h2>
        <ul className="theater-legend">
          {[['STANDARD', theme.standard, 'Standard'], ['VIP', theme.vip, roomType === 'IMAX' ? 'VIP Prime' : 'VIP'], ['SWEETBOX', theme.vip, 'Ghế đôi']].filter(([type]) =>
            rows.some(({ left, right }) => [...left, ...right].some((seat) => seat.type === type))
          ).map(([type, color, title]) => <li key={type}><Armchair size={18} style={{ color }} />{title}</li>)}
        </ul>
        <dl>
          <div><dt>Ghế đang xem</dt><dd>{viewing?.seatNumber ?? '—'}</dd></div>
          <div><dt>Ghế đang chọn</dt><dd>{selectedSeats.join(', ') || '—'}</dd></div>
          <div><dt>Tổng tiền</dt><dd>{formatMoney(total)}</dd></div>
        </dl>
        <button type="button" className="theater-action" disabled={!viewing || booked}
          onClick={() => onSeatClick(viewing.seatNumber)}>
          {booked ? 'Ghế đã bán' : selected ? '✓ Bỏ chọn ghế' : 'Chọn ghế này'}
        </button>
        <button type="button" className="theater-action theater-primary" disabled={!selectedSeats.length} onClick={onConfirm}>
          Xác nhận ghế →
        </button>
      </aside>

      <div className="theater-stage">
        <div ref={mount} className={`theater-canvas ${freeLook ? 'theater-drag' : ''}`} />
        {failure && <div className="theater-fallback" role="status">{failure}<button type="button" onClick={onClose}>Về sơ đồ 2D</button></div>}
      </div>

      <aside className={`${panel} theater-map`}>
        <div className="theater-map-screen">Màn hình</div>
        <div className="theater-mini-grid" aria-label="Sơ đồ ghế thu nhỏ">
          {rows.map(({ label, crossAisle, left, right }) => (
            <div key={label} className="theater-mini-row" data-cross-aisle={crossAisle}>
              <span>{label}</span>
              {[['left', left], ['right', right]].map(([side, group]) => (
                <div className="theater-mini-bank" key={side}>
                  {group.map(({ id, seatNumber, type }) => (
                    <button type="button" key={id}
                      style={{ '--seat-color': type === 'STANDARD' ? theme.standard : theme.vip }}
                      className="theater-mini-seat"
                      data-couple={type === 'SWEETBOX'}
                      data-booked={bookedSeats.includes(seatNumber)}
                      data-selected={selectedSeats.includes(seatNumber)}
                      aria-pressed={viewingId === id}
                      title={`Ghế ${seatNumber}`}
                      aria-label={`Xem ghế ${seatNumber}${bookedSeats.includes(seatNumber) ? ' đã bán' : ''}`}
                      onClick={() => showSeat(id)}>{selectedSeats.includes(seatNumber) && '✓'}</button>
                  ))}
                </div>
              ))}
              <span>{label}</span>
            </div>
          ))}
        </div>
        <button type="button" className="theater-action theater-primary" disabled={!viewing} onClick={() => showSeat()}><Armchair size={17} /> Xem góc nhìn 3D</button>
        <button type="button" className="theater-action" onClick={onClose}><MapIcon size={17} /> Xem sơ đồ 2D</button>
        <button type="button" className="theater-action" onClick={tour}><Box size={17} /> Không gian rạp</button>
      </aside>

      <div className={`${panel} theater-dock`} aria-label="Điều khiển góc nhìn">
        {controls.map(([Icon, label, action, active], index) => (
          <button type="button" key={label} aria-pressed={active} onClick={action} disabled={index < 4 && Boolean(failure)}>
            <Icon size={21} /><span>{label}{index === 0 && viewing && ` (${viewing.seatNumber})`}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
