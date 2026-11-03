import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../pages-dist/', import.meta.url));
const build = fileURLToPath(new URL('../dist/', import.meta.url));
const site = await readFile(`${build}/index.html`, 'utf8');
if (!site.includes('assets/')) {
  throw new Error('Expected compiled site assets before packaging.');
}
// Only this dedicated generated directory is replaced. Source and dist stay intact.
// The site's own homepage (the React landing) is the root, as on the hosted site.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(build, output, { recursive: true });
await writeFile(`${output}/.nojekyll`, '');
console.log('Pages package ready in pages-dist/: the site at /. Nothing published.');
