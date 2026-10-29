import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(resolve(directory, entry.name))
          : entry.name.endsWith('.ts')
            ? [resolve(directory, entry.name)]
            : [],
      ),
    )
  ).flat();
}
for (const [directory, allowed] of [
  ['packages/contracts/src', ['zod']],
  ['packages/core/src', ['@renovagent/contracts']],
]) {
  const root = resolve(directory);
  for (const file of await walk(root)) {
    const source = await readFile(file, 'utf8');
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
      const internal =
        dependency.startsWith('.') &&
        !relative(root, resolve(dirname(file), dependency)).startsWith('..');
      if (!internal && !allowed.includes(dependency))
        throw Error(`${relative('.', file)} imports forbidden dependency ${dependency}`);
    }
  }
}
console.log(
  'Foundation dependency boundaries pass: contracts/core have no UI, storage, or provider imports.',
);
