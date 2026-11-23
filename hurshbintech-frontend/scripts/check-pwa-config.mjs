// Exercise Vite's actual import analysis with PWA disabled and enabled.
// Run from hurshbintech-frontend: node scripts/check-pwa-config.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const previous = process.env.VITE_ENABLE_PWA;
try {
  for (const enabled of [false, true]) {
    process.env.VITE_ENABLE_PWA = String(enabled);
    const server = await createServer({
      logLevel: 'error',
      server: { middlewareMode: true, hmr: false, preTransformRequests: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const transformed = await server.transformRequest('/src/App.jsx');
      assert.ok(transformed?.code, 'App.jsx must pass Vite import analysis');
      const client = server.environments.client.pluginContainer;
      const resolved = await client.resolveId('virtual:pwa-register');
      assert.ok(resolved?.id, 'PWA registration module must always resolve');
      const loaded = await client.load(resolved.id);
      const code = typeof loaded === 'string' ? loaded : loaded?.code;
      assert.ok(code?.includes('registerSW'));
      if (!enabled) {
        // The plugin's disabled implementation must be usable without browser APIs.
        const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
        assert.equal(typeof module.registerSW(), 'function');
        await module.registerSW()();
      }
      assert.equal(server.config.plugins.find(p => p.name === 'vite-plugin-pwa').api.disabled, !enabled);
      console.log(`PWA ${enabled ? 'enabled' : 'disabled'}: App.jsx transforms and registration module resolves.`);
    } finally {
      await server.close();
    }
  }
} finally {
  if (previous === undefined) delete process.env.VITE_ENABLE_PWA;
  else process.env.VITE_ENABLE_PWA = previous;
}
