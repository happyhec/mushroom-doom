// X/Z collision helpers shared by movement, projectiles and navigation.
export function blocked(x, z, radius, colliders) {
  return colliders.some(c => {
    const px = Math.max(c.minX, Math.min(x, c.maxX));
    const pz = Math.max(c.minZ, Math.min(z, c.maxZ));
    return (px - x) ** 2 + (pz - z) ** 2 < radius * radius;
  });
}

export function moveCircle(position, dx, dz, radius, colliders) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * .65)));
  let moved = false;
  for (let i = 0; i < steps; i++) {
    if (dx !== 0 && !blocked(position.x + dx / steps, position.z, radius, colliders)) { position.x += dx / steps; moved = true; }
    if (dz !== 0 && !blocked(position.x, position.z + dz / steps, radius, colliders)) { position.z += dz / steps; moved = true; }
  }
  return moved;
}

export function segmentBlocked(ax, az, bx, bz, colliders, padding = 0) {
  const dx = bx - ax, dz = bz - az;
  return colliders.some(c => {
    let near = 0, far = 1;
    for (const [origin, direction, min, max] of [[ax, dx, c.minX - padding, c.maxX + padding], [az, dz, c.minZ - padding, c.maxZ + padding]]) {
      if (Math.abs(direction) < 1e-8) { if (origin < min || origin > max) return false; }
      else {
        const a = (min - origin) / direction, b = (max - origin) / direction;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        if (near > far) return false;
      }
    }
    return far > .001 && near < .999;
  });
}
