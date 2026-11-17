import { Vector2 } from 'three';

// An original, deliberately small DOS-era palette: soot, worn stone, leather,
// toxic greens, lava and cold highlights. Values are display-referred sRGB.
export const RETRO_PALETTE = Object.freeze([
  '#080b09', '#151912', '#262b20', '#3b4032', '#575c48', '#777b61',
  '#a1a38a', '#d0cbb0', '#f1e6c6', '#fff7df',
  '#21150f', '#382519', '#513720', '#704b2c', '#92653b', '#b28a56',
  '#c8a975', '#dfc99a',
  '#102519', '#1c3922', '#2f4c2b', '#45653c', '#64824d', '#88a564',
  '#b2ca88',
  '#2b1012', '#4d1816', '#75251c', '#a33725', '#c94a2e', '#e86738',
  '#f18b4c',
  '#6f361b', '#98521f', '#b67a29', '#d49e37', '#ebbf51', '#f7da7e',
  '#ffeba8',
  '#101c29', '#223343', '#394d5d', '#5b737b', '#88a1a2', '#bdcebf',
  '#27534b', '#4c977a', '#90d3a2',
]);

const paletteGLSL = RETRO_PALETTE.map((hex, i) => {
  const value = Number.parseInt(hex.slice(1), 16);
  const rgb = [value >> 16, (value >> 8) & 255, value & 255]
    .map(channel => (channel / 255).toFixed(6)).join(', ');
  return `  palette[${i}] = vec3(${rgb});`;
}).join('\n');

/** Widescreen preserves world proportions while using a 200-line framebuffer. */
export function retroResolution(width, height) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 320;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 200;
  return { width: Math.max(1, Math.round(200 * safeWidth / safeHeight)), height: 200 };
}

// Run after OutputPass, then enlarge the framebuffer with nearest-neighbor
// filtering. Keep this pass last: it emits palette colors without tone mapping.
export const RetroShader = {
  name: 'Mushroom1993Shader',
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(320, 200) },
    time: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    varying vec2 vUv;

    float bayer2(vec2 p) {
      if (p.y < 1.0) return p.x < 1.0 ? 0.0 : 2.0;
      return p.x < 1.0 ? 3.0 : 1.0;
    }

    float orderedDither(vec2 pixel) {
      vec2 p = mod(floor(pixel), 4.0);
      float value = 4.0 * bayer2(mod(p, 2.0)) + bayer2(floor(p / 2.0));
      return (value + 0.5) / 16.0 - 0.5;
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = clamp((source.rgb - 0.5) * 0.95 + 0.5, 0.0, 1.0);
      // A tiny warm cast ties modern materials to the handmade palette.
      color *= vec3(1.012, 1.0, 0.975);
      // Screen-anchored dithering stays still while moving, like a DOS frame.
      color += orderedDither(vUv * resolution) * 0.018;
      color = clamp(color, 0.0, 1.0);

      vec3 palette[${RETRO_PALETTE.length}];
${paletteGLSL}
      vec3 weights = vec3(0.30, 0.59, 0.11);
      vec3 nearest = palette[0];
      float minimumDistance = 100.0;
      for (int i = 0; i < ${RETRO_PALETTE.length}; i++) {
        vec3 delta = color - palette[i];
        float luminanceDifference = dot(delta, weights);
        float distance = dot(delta * delta, weights)
          + luminanceDifference * luminanceDifference * 0.35;
        if (distance < minimumDistance) {
          minimumDistance = distance;
          nearest = palette[i];
        }
      }
      gl_FragColor = vec4(nearest, source.a);
    }
  `,
};
