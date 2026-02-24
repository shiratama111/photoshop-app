import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@photoshop-app/types': path.resolve(__dirname, 'packages/types/src/index.ts'),
      '@photoshop-app/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@photoshop-app/render': path.resolve(__dirname, 'packages/render/src/index.ts'),
      '@photoshop-app/adapter-abr': path.resolve(__dirname, 'packages/adapter-abr/src/index.ts'),
      '@photoshop-app/adapter-asl': path.resolve(__dirname, 'packages/adapter-asl/src/index.ts'),
      '@photoshop-app/adapter-psd': path.resolve(__dirname, 'packages/adapter-psd/src/index.ts'),
      '@photoshop-app/ai': path.resolve(__dirname, 'packages/ai/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'packages/*/src/**/*.test.ts',
        'src/**/index.ts',
        'packages/*/src/**/index.ts',
      ],
    },
  },
});
