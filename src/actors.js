import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All characters face +Z. The outer group is reserved for movement and aiming.
const M = {};
const material = (name, color, extra = {}) => M[name] ||= new THREE.MeshStandardMaterial({ color, roughness: .68, ...extra });
const chestnut = material('chestnut', 0x865036);
const darkBrown = material('darkBrown', 0x38271d);
const cream = material('cream', 0xe8c994);
const white = material('white', 0xf2e9d6);
const black = material('black', 0x090d09, { roughness: .3 });
const yellow = material('yellow', 0xd8a23a);
const green = material('green', 0x285834);
const shellDark = material('shellDark', 0x142e20);
const red = material('red', 0xb72c24);
const orange = material('orange', 0xbc5828);
const steel = material('steel', 0x3a4545, { metalness: .82, roughness: .28 });
const steelDark = material('steelDark', 0x151d20, { metalness: .85, roughness: .4 });
const brass = material('brass', 0xa67d3c, { metalness: .72, roughness: .33 });
const wood = material('wood', 0x70432a, { roughness: .54 });
const fire = material('fire', 0xffb431, { emissive: 0xff7420, emissiveIntensity: 1.8, roughness: .4 });
const ghost = material('ghost', 0xc9d6ce, { emissive: 0x345354, emissiveIntensity: .32, roughness: .24 });

function ellipsoid(parent, mat, x, y, z, sx, sy, sz, segments = 18) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, 12), mat);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
}
function box(parent, mat, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function cylinder(parent, mat, x, y, z, radius, length, radiusEnd = radius, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radius, length, segments), mat);
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function spike(parent, mat, origin, tip, radius) {
  const a = new THREE.Vector3(...origin), b = new THREE.Vector3(...tip), delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, delta.length(), 10), mat);
  mesh.position.copy(a.add(b).multiplyScalar(.5)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh); return mesh;
}
function ring(parent, mat, x, y, z, radius, tube, rotateX = 0) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 20), mat);
  mesh.position.set(x, y, z); mesh.rotation.x = rotateX; parent.add(mesh); return mesh;
}
// Bake static sculpted pieces by material: detailed models stay inexpensive in crowds.
function bake(group) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map();
  for (const mesh of group.children) {
    if (!mesh.isMesh) continue;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
    if (!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, []);
    byMaterial.get(mesh.material).push(geometry);
  }
  for (const child of [...group.children]) {
    if (child.isMesh) { group.remove(child); child.geometry.dispose(); }
  }
  for (const [mat, geometries] of byMaterial) {
    // Different primitive indices/attributes normalize to position, normal and uv.
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    geometries.forEach(g => g.dispose());
  }
  return group;
}
function eyes(parent, x, y, z, size = 1, angry = true, iris = black) {
  for (const side of [-1, 1]) {
    ellipsoid(parent, white, side * x, y, z, .13 * size, .21 * size, .075 * size);
    ellipsoid(parent, iris, side * x - side * .025 * size, y - .018 * size, z + .07 * size, .051 * size, .105 * size, .024 * size);
    ellipsoid(parent, white, side * x - side * .035 * size, y + .025 * size, z + .09 * size, .016 * size, .025 * size, .009 * size, 10);
    if (angry) {
      const brow = ellipsoid(parent, darkBrown, side * x, y + .18 * size, z + .045 * size, .18 * size, .048 * size, .06 * size);
      brow.rotation.z = side * .3;
    }
  }
}
function animatedLimb(parent, mat, x, y, z, scale, footColor = mat) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z);
  ellipsoid(pivot, mat, 0, -.12 * scale, 0, .12 * scale, .25 * scale, .13 * scale);
  ellipsoid(pivot, footColor, 0, -.28 * scale, .09 * scale, .2 * scale, .13 * scale, .28 * scale);
  bake(pivot); parent.add(pivot); return pivot;
}

export function createEnemyModel(type = 'goomba') {
  const model = new THREE.Group();
  const body = new THREE.Group(); model.add(body);
  const staticBody = new THREE.Group(); body.add(staticBody);
  const limbs = [];
  if (type === 'goomba') {
    model.userData.height = 1.38; model.userData.radius = .55;
    ellipsoid(staticBody, cream, 0, .47, 0, .33, .4, .3);
    ellipsoid(staticBody, chestnut, 0, .97, 0, .64, .46, .49);
    ellipsoid(staticBody, chestnut, -.35, .79, 0, .3, .23, .39);
    ellipsoid(staticBody, chestnut, .35, .79, 0, .3, .23, .39);
    eyes(staticBody, .21, .96, .437, 1.12);
    ellipsoid(staticBody, darkBrown, 0, .7, .424, .24, .065, .035);
    spike(staticBody, white, [-.16, .66, .45], [-.16, .8, .46], .055);
    spike(staticBody, white, [.16, .66, .45], [.16, .8, .46], .055);
    limbs.push(animatedLimb(body, darkBrown, -.27, .37, .02, .9));
    limbs.push(animatedLimb(body, darkBrown, .27, .37, .02, .9));
  } else if (type === 'koopa') {
    model.userData.height = 1.95; model.userData.radius = .52;
    ellipsoid(staticBody, cream, 0, .91, .1, .39, .54, .26);
    ellipsoid(staticBody, white, 0, .91, -.13, .48, .57, .31);
    ellipsoid(staticBody, green, 0, .94, -.26, .45, .54, .3);
    for (const y of [.65, .85, 1.05]) box(staticBody, yellow, 0, y, .344, .48, .025, .018);
    ring(staticBody, shellDark, 0, .96, -.545, .24, .025);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3; const seam = box(staticBody, shellDark, Math.sin(a) * .29, .95 + Math.cos(a) * .35, -.49, .025, .23, .025); seam.rotation.z = -a;
    }
    ellipsoid(staticBody, yellow, 0, 1.55, .075, .31, .38, .29);
    ellipsoid(staticBody, yellow, 0, 1.4, .32, .32, .2, .29);
    eyes(staticBody, .138, 1.69, .295, .85);
    ellipsoid(staticBody, darkBrown, 0, 1.33, .58, .17, .026, .018);
    for (const side of [-1, 1]) {
      ellipsoid(staticBody, darkBrown, side * .1, 1.49, .566, .02, .015, .012, 8);
      ellipsoid(staticBody, yellow, side * .43, 1.03, .035, .16, .28, .16);
      ellipsoid(staticBody, yellow, side * .45, .8, .1, .18, .17, .18);
    }
    limbs.push(animatedLimb(body, yellow, -.23, .43, .04, 1, red));
    limbs.push(animatedLimb(body, yellow, .23, .43, .04, 1, red));
  } else if (type === 'boo') {
    model.userData.height = 1.7; model.userData.radius = .58;
    ellipsoid(staticBody, ghost, 0, 1.03, 0, .6, .57, .55);
    spike(staticBody, ghost, [0, .76, -.2], [0, .49, -.76], .3);
    for (const side of [-1, 1]) {
      const arm = ellipsoid(staticBody, ghost, side * .58, 1.02, .05, .28, .13, .15); arm.rotation.z = side * .3;
      ellipsoid(staticBody, black, side * .19, 1.24, .49, .054, .14, .03);
      const brow = box(staticBody, black, side * .19, 1.4, .45, .16, .035, .04); brow.rotation.z = side * .3;
    }
    ellipsoid(staticBody, darkBrown, 0, .94, .507, .28, .2, .06);
    ellipsoid(staticBody, material('tongue', 0xd15f7c), 0, .82, .57, .16, .1, .1);
    for (const x of [-.18, -.06, .06, .18]) spike(staticBody, white, [x, 1.08, .56], [x, .94, .59], .042);
  } else if (type === 'bowser') {
    model.userData.height = 3.8; model.userData.radius = 1.08;
    ellipsoid(staticBody, yellow, 0, 1.56, .12, .8, 1.08, .61);
    ellipsoid(staticBody, cream, 0, 1.53, .55, .58, .91, .2);
    for (const y of [.93, 1.21, 1.49, 1.77, 2.05]) {
      const seam = ring(staticBody, yellow, 0, y, .38, .49, .025, Math.PI / 2); seam.scale.set(1, .65, 1);
    }
    ellipsoid(staticBody, white, 0, 1.7, -.26, .99, 1.1, .67);
    ellipsoid(staticBody, green, 0, 1.75, -.43, .92, 1.04, .65);
    for (const x of [-.58, 0, .58]) for (const y of [1.2, 1.83, 2.45]) {
      const baseZ = -.78 + Math.abs(x) * .18;
      ellipsoid(staticBody, brass, x, y, baseZ, .2, .2, .1);
      spike(staticBody, cream, [x, y, baseZ], [x * 1.3, y + .2, baseZ - .58], .18);
    }
    // Broad reptilian face, heavy brow, nostrils and an open, fang-lined jaw.
    ellipsoid(staticBody, yellow, 0, 2.87, .23, .6, .55, .5);
    ellipsoid(staticBody, yellow, 0, 2.66, .63, .66, .34, .45);
    ellipsoid(staticBody, darkBrown, 0, 2.47, .84, .49, .16, .2);
    ellipsoid(staticBody, cream, 0, 2.31, .68, .5, .15, .35);
    eyes(staticBody, .24, 3.04, .62, 1.2, false, material('bowserEye', 0xc02716, { emissive: 0x7c1d10, emissiveIntensity: .35 }));
    for (const side of [-1, 1]) {
      const brow = ellipsoid(staticBody, orange, side * .25, 3.24, .64, .3, .1, .11); brow.rotation.z = side * .28;
      ellipsoid(staticBody, darkBrown, side * .21, 2.8, 1.015, .07, .045, .025);
      spike(staticBody, white, [side * .37, 2.57, 1.01], [side * .37, 2.31, 1.06], .085);
      spike(staticBody, cream, [side * .47, 3.15, .1], [side * .76, 3.69, .11], .19);
      ellipsoid(staticBody, yellow, side * .9, 1.99, .2, .33, .49, .34);
      ellipsoid(staticBody, yellow, side * 1.02, 1.55, .38, .34, .35, .34);
      cylinder(staticBody, steelDark, side * 1.01, 1.72, .33, .35, .18);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        spike(staticBody, steel, [side * 1.01 + Math.sin(a) * .3, 1.72, .33 + Math.cos(a) * .3], [side * 1.01 + Math.sin(a) * .45, 1.72, .33 + Math.cos(a) * .45], .07);
      }
      for (const dx of [-.16, 0, .16]) spike(staticBody, white, [side * 1.03 + dx, 1.35, .58], [side * 1.03 + dx, 1.23, .81], .065);
    }
    // Red mane and central ridge create the Bowser silhouette from every angle.
    for (let i = 0; i < 6; i++) {
      const z = .48 - i * .2;
      spike(staticBody, orange, [0, 3.22 - i * .025, z], [0, 3.78 - i * .07, z - .13], .22);
    }
    spike(staticBody, yellow, [0, .8, -.51], [0, .4, -1.65], .35);
    spike(staticBody, cream, [0, .5, -1.43], [0, .74, -1.9], .16);
    limbs.push(animatedLimb(body, yellow, -.49, .62, .04, 1.65));
    limbs.push(animatedLimb(body, yellow, .49, .62, .04, 1.65));
  } else {
    return createEnemyModel('goomba');
  }
  bake(staticBody);
  model.userData.body = body;
  model.userData.limbs = limbs;
  model.userData.phase = Math.random() * Math.PI * 2;
  model.userData.type = type;
  return model;
}

export function animateEnemy(model, type, time, moving = true, dt = 0) {
  const phase = model.userData.phase || 0;
  const pace = time * (type === 'bowser' ? 5 : 9) + phase;
  const body = model.userData.body;
  if (!body) return;
  if (type === 'boo') {
    body.position.y = Math.sin(time * 2.6 + phase) * .15;
    body.rotation.z = Math.sin(time * 1.8 + phase) * .065;
  } else {
    body.position.y = moving ? Math.abs(Math.sin(pace)) * (type === 'bowser' ? .035 : .055) : 0;
    body.rotation.z = moving ? Math.sin(pace) * .035 : Math.sin(time * 2 + phase) * .008;
    for (let i = 0; i < model.userData.limbs.length; i++) model.userData.limbs[i].rotation.x = moving ? Math.sin(pace + i * Math.PI) * .35 : 0;
  }
}

function barrel(parent, mat, x, y, z, r, length) {
  const mesh = cylinder(parent, mat, x, y, z, r, length); mesh.rotation.x = Math.PI / 2; return mesh;
}
function screw(parent, x, y, z) {
  const part = barrel(parent, steel, x, y, z, .009, .008); return part;
}
export function createWeaponModel(type = 'shotgun') {
  const weapon = new THREE.Group();
  if (type === 'shotgun') {
    // Parallel bored barrels, ventilated rib, brass chamber and walnut pump.
    for (const x of [-.055, .055]) {
      barrel(weapon, steel, x, .045, -.19, .047, .55);
      barrel(weapon, steelDark, x, .045, -.477, .035, .008);
      ring(weapon, steel, x, .045, -.482, .04, .006);
    }
    box(weapon, steelDark, 0, .103, -.21, .018, .018, .56);
    box(weapon, brass, 0, .124, -.43, .014, .025, .018);
    box(weapon, steel, 0, .025, .145, .155, .145, .22);
    box(weapon, steelDark, 0, .106, .14, .115, .02, .21);
    box(weapon, brass, .079, .038, .14, .008, .07, .11);
    for (const z of [.11, .17]) screw(weapon, .083, .039, z);
    const grip = box(weapon, wood, .015, -.098, .23, .095, .22, .12); grip.rotation.x = -.35;
    ellipsoid(weapon, wood, 0, -.025, -.135, .105, .075, .18);
    for (let i = 0; i < 7; i++) box(weapon, darkBrown, 0, -.059, -.26 + i * .038, .17, .033, .009);
    const trigger = ring(weapon, steel, 0, -.11, .09, .052, .009); trigger.rotation.y = Math.PI / 2;
    box(weapon, steelDark, 0, -.084, .1, .018, .045, .018);
    // Cream leather work gloves and a red sleeve ground the player in this world.
    ellipsoid(weapon, white, -.065, -.105, -.09, .075, .062, .115);
    ellipsoid(weapon, white, .055, -.14, .23, .074, .075, .09);
    for (let i = 0; i < 3; i++) box(weapon, cream, -.105 + i * .025, -.142, -.1, .007, .012, .07);
    const arm = cylinder(weapon, red, .08, -.24, .3, .08, .24); arm.rotation.x = -.6;
    ring(weapon, cream, .063, -.177, .25, .073, .012, Math.PI / 2);
    weapon.userData.muzzle = new THREE.Vector3(0, .045, -.5);
  } else {
    barrel(weapon, green, 0, .015, -.14, .117, .48);
    barrel(weapon, shellDark, 0, .015, -.39, .09, .015);
    ring(weapon, brass, 0, .015, -.4, .12, .018);
    ring(weapon, brass, 0, .015, .07, .12, .016);
    for (const x of [-.07, .07]) box(weapon, brass, x, .11, -.14, .02, .026, .34);
    box(weapon, steelDark, 0, -.1, .15, .12, .24, .16);
    ellipsoid(weapon, white, .055, -.14, .18, .08, .075, .1);
    const arm = cylinder(weapon, red, .08, -.25, .25, .08, .23); arm.rotation.x = -.6;
    // Living fire flower sight and glowing fuel chamber.
    cylinder(weapon, green, 0, .17, -.03, .018, .22);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      ellipsoid(weapon, i % 2 ? orange : red, Math.cos(a) * .07, .28 + Math.sin(a) * .07, -.03, .055, .055, .024, 12);
    }
    ellipsoid(weapon, fire, 0, .28, -.007, .06, .07, .02);
    for (const x of [-.018, .018]) ellipsoid(weapon, black, x, .29, .014, .007, .017, .004, 8);
    barrel(weapon, fire, 0, .015, -.402, .06, .015);
    for (let i = 0; i < 4; i++) box(weapon, fire, .111, .015, -.28 + i * .075, .012, .07, .034);
    weapon.userData.muzzle = new THREE.Vector3(0, .015, -.43);
  }
  bake(weapon);
  weapon.traverse(child => {
    if (child.isMesh) { child.castShadow = false; child.receiveShadow = false; child.frustumCulled = false; }
  });
  return weapon;
}

export function createPickupModel(type = 'ammo') {
  const group = new THREE.Group();
  if (type === 'health') {
    cylinder(group, cream, 0, .21, 0, .16, .31);
    ellipsoid(group, red, 0, .41, 0, .35, .24, .35);
    ellipsoid(group, white, 0, .62, 0, .12, .027, .12);
    for (const a of [0, Math.PI * .5, Math.PI, Math.PI * 1.5]) {
      const dot = ellipsoid(group, white, Math.sin(a) * .27, .46, Math.cos(a) * .27, .1, .09, .04);
      dot.rotation.y = a;
    }
    for (const x of [-.065, .065]) ellipsoid(group, black, x, .23, .148, .018, .045, .015, 8);
  } else if (type === 'armor') {
    ellipsoid(group, white, 0, .24, 0, .39, .18, .3);
    ellipsoid(group, green, 0, .34, 0, .35, .27, .28);
    for (const x of [-.15, .15]) {
      const seam = box(group, shellDark, x, .57, 0, .013, .015, .3); seam.rotation.z = x > 0 ? -.4 : .4;
    }
    ring(group, shellDark, 0, .33, .26, .12, .016);
  } else if (type === 'key') {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 === 0 ? .39 : .18;
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .025, bevelThickness: .025 }), material('starGold', 0xffcb43, { metalness: .7, roughness: .2, emissive: 0xd28013, emissiveIntensity: .65 }));
    star.position.set(0, .5, -.055); group.add(star);
    for (const x of [-.08, .08]) ellipsoid(group, black, x, .52, .087, .022, .062, .012, 10);
  } else {
    box(group, steelDark, 0, .11, 0, .42, .18, .28);
    box(group, brass, 0, .195, 0, .44, .018, .3);
    for (const x of [-.14, 0, .14]) {
      cylinder(group, red, x, .32, 0, .058, .25);
      cylinder(group, brass, x, .435, 0, .061, .045);
      cylinder(group, steelDark, x, .458, 0, .023, .004, .023, 10);
    }
  }
  bake(group);
  group.userData.radius = .4;
  return group;
}
