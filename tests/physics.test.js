import test from 'node:test';
import assert from 'node:assert/strict';
import { blocked, moveCircle, segmentBlocked } from '../src/physics.js';

const wall = { minX: 2, maxX: 3, minZ: -5, maxZ: 5 };
const near = (actual, expected, tolerance = 1e-9) => assert.ok(
  Math.abs(actual - expected) <= tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`,
);

test('circle collision respects radius, including rounded obstacle corners', () => {
  assert.equal(blocked(1.6, 0, .5, [wall]), true);
  assert.equal(blocked(1.5, 0, .5, [wall]), false, 'Exact contact is permitted');
  assert.equal(blocked(1.7, 5.3, .5, [wall]), true, 'Circle overlaps the corner');
  assert.equal(blocked(1.6, 5.4, .5, [wall]), false, 'The square radius bounds alone do not collide');
  assert.equal(blocked(2.5, 0, .5, [wall]), true, 'Centers within a wall are blocked');
});

test('unobstructed movement preserves the full requested displacement', () => {
  const position = { x: -3, z: 4 };
  assert.equal(moveCircle(position, 7, -2, .35, []), true);
  near(position.x, 4);
  near(position.z, 2);
});

test('a stationary circle reports no movement', () => {
  const position = { x: 0, z: 0 };
  assert.equal(moveCircle(position, 0, 0, .35, [wall]), false);
  assert.deepEqual(position, { x: 0, z: 0 });
});

test('a wall stops movement before the circle enters it', () => {
  const position = { x: 0, z: 0 };
  moveCircle(position, 5, 0, .35, [wall]);
  assert.ok(position.x > 1.4 && position.x <= 1.65);
  assert.equal(blocked(position.x, position.z, .35, [wall]), false);
  near(position.z, 0);
  assert.equal(moveCircle(position, .5, 0, .35, [wall]), false);
});

test('diagonal movement slides along the face of a wall', () => {
  const position = { x: 0, z: -3 };
  moveCircle(position, 4, 5, .35, [wall]);
  assert.ok(position.x <= 1.65 && position.x > 1.4);
  near(position.z, 2);
  assert.equal(blocked(position.x, position.z, .35, [wall]), false);
});

test('high-speed movement cannot tunnel through a very thin wall', () => {
  const thinWall = { minX: .01, maxX: .02, minZ: -20, maxZ: 20 };
  const position = { x: -30, z: 0 };
  moveCircle(position, 100, 0, .35, [thinWall]);
  assert.ok(position.x <= -.34, `Crossed thin wall: x=${position.x}`);
  assert.ok(position.x > -.6, 'Movement should reach the wall');
  assert.equal(blocked(position.x, position.z, .35, [thinWall]), false);
});

test('diagonal movement cannot clip through an inside corner', () => {
  const corner = [
    { minX: 2, maxX: 3, minZ: -20, maxZ: 3 },
    { minX: -20, maxX: 3, minZ: 2, maxZ: 3 },
  ];
  const position = { x: 0, z: 0 };
  moveCircle(position, 20, 20, .35, corner);
  assert.ok(position.x <= 1.65 && position.z <= 1.65);
  assert.ok(position.x > 1.4 && position.z > 1.4);
  assert.equal(blocked(position.x, position.z, .35, corner), false);
});

test('line of sight passes through a gate and is blocked by its walls', () => {
  const gate = [
    { minX: -10, maxX: -2, minZ: -1, maxZ: 1 },
    { minX: 2, maxX: 10, minZ: -1, maxZ: 1 },
  ];
  assert.equal(segmentBlocked(0, 8, 0, -8, gate), false);
  assert.equal(segmentBlocked(4, 8, 4, -8, gate), true);
  assert.equal(segmentBlocked(-4, -8, -4, 8, gate), true);
  assert.equal(segmentBlocked(0, 8, 0, -8, gate, 2.1), true, 'Padding can close a narrow opening');
});

test('parallel segments correctly distinguish outside, inside, and beyond a wall', () => {
  assert.equal(segmentBlocked(1, -10, 1, 10, [wall]), false);
  assert.equal(segmentBlocked(2.5, -10, 2.5, 10, [wall]), true);
  assert.equal(segmentBlocked(2.5, 6, 2.5, 12, [wall]), false);
  assert.equal(segmentBlocked(-5, 6, 5, 6, [wall]), false);
  assert.equal(segmentBlocked(-5, 0, 5, 0, [wall]), true);
});

test('line of sight is bounded to the segment and symmetric on reversal', () => {
  assert.equal(segmentBlocked(-5, 0, 1, 0, [wall]), false);
  assert.equal(segmentBlocked(4, 0, 8, 0, [wall]), false);
  for (const [ax, az, bx, bz] of [[0, 0, 5, 3], [0, 0, 5, 12], [4, 9, 1, -9]]) {
    assert.equal(segmentBlocked(ax, az, bx, bz, [wall]), segmentBlocked(bx, bz, ax, az, [wall]));
  }
});
