// Test bootstrap for `pnpm test` (node:test, no extra dependencies).
// - resolves the app's extensionless TypeScript imports
// - swaps native-only modules for stubs so adapters can run under Node
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const STUBS = {
  secureStorage: pathToFileURL(resolvePath(import.meta.dirname, '../tests/stubs/secureStorage.ts'))
    .href,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const stub = STUBS[specifier.split('/').pop()];
      if (stub) return { url: stub, shortCircuit: true };
      const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        if (existsSync(base + ext)) {
          return { url: pathToFileURL(base + ext).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
