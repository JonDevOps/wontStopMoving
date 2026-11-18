// Node's test runner executes shared TypeScript directly; mirror Next's @/ alias.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier.startsWith('@/'))return nextResolve(pathToFileURL(resolve('src',`${specifier.slice(2)}.ts`)).href,context);
  return nextResolve(specifier,context);
}});
