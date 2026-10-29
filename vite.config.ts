import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Dev only: `?render=dock` renders the laptop dock plate from the page's own 3D scene and POSTs the image here;
 * it is written to public/images, where the pricing section reads it as a plain image.
 */
function renderSink(): Plugin {
  const dir = fileURLToPath(new URL('./public/images', import.meta.url));
  return {
    name: 'render-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__render', (req, res) => {
        const name = path.basename(req.url ?? '');
        if (req.method !== 'POST' || !/^card-dock\.(png|webp)$/.test(name)) { res.statusCode = 400; res.end('bad request'); return; }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => { fs.writeFileSync(path.join(dir, name), Buffer.concat(chunks)); res.end('ok'); });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), renderSink()],
  server: { port: 5173, host: true },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
});
