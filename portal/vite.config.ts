import { defineConfig } from 'vitest/config';
export default defineConfig({ server: { proxy: { '/source-catalog.json': 'http://127.0.0.1:4173', '/catalog.json': 'http://127.0.0.1:4173', '/api/summary': 'http://127.0.0.1:4173', '/api/hec': 'http://127.0.0.1:4173' } }, test: { include: ['src/**/*.test.ts'] } });
