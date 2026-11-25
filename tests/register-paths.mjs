// Node's test runner executes shared TypeScript directly; mirror Next's @/ alias.
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('@/'))return nextResolve(pathToFileURL(resolve('src',`${specifier.slice(2)}.ts`)).href,context);
  if(specifier.startsWith('.') && !extname(specifier) && context.parentURL?.startsWith('file:')) {
    const candidate=resolve(dirname(fileURLToPath(context.parentURL)),`${specifier}.ts`);
    if(existsSync(candidate))return nextResolve(pathToFileURL(candidate).href,context);
  }
  return nextResolve(specifier,context);
}});
