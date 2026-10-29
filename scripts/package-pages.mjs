import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../pages-dist/', import.meta.url));
const build = fileURLToPath(new URL('../dist/', import.meta.url));
const landing = await readFile(`${build}/landing.html`, 'utf8');
const workspace = await readFile(`${build}/index.html`, 'utf8');
if (!landing.includes('./index.html') || !workspace.includes('assets/')) {
  throw new Error('Expected landing link and compiled workspace assets before packaging.');
}
// Only this dedicated generated directory is replaced. Source and dist stay intact.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(build, output, { recursive: true });
await writeFile(`${output}/workspace.html`, workspace);
const homepage = landing
  .replaceAll('./index.html', './workspace.html')
  .replaceAll('./landing.html', './index.html');
await writeFile(`${output}/index.html`, homepage);
await writeFile(`${output}/landing.html`, homepage);
await writeFile(`${output}/.nojekyll`, '');
console.log(
  'Pages package ready in pages-dist/: landing at /, prototype at /workspace.html. Nothing published.',
);
