import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMuse } from '../../scripts/muse-provider.js';
test('Muse credentials use stdin, never argv, and are redacted from provider output and failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'muse-auth-test-'));
  const previousPath = process.env.PATH,
    previousKey = process.env.MUSE_API_KEY;
  const fakeKey = 'synthetic-key-for-stdin-test-only';
  try {
    const script = join(directory, 'muse');
    await writeFile(
      script,
      `#!${process.execPath}\nlet input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{if(process.argv.includes('--fail')){process.stderr.write('rejected credential '+input.trim());process.exitCode=2;}else process.stdout.write(JSON.stringify({args:process.argv.slice(2),received:input.trim()}));});\n`,
    );
    await chmod(script, 0o755);
    process.env.PATH = directory + ':' + previousPath;
    process.env.MUSE_API_KEY = fakeKey;
    const result = JSON.parse(await runMuse(['exec', '--json'], 5000));
    assert.deepEqual(result.args, ['exec', '--json', '--api-key-stdin']);
    assert.equal(result.received, '[REDACTED]');
    await assert.rejects(
      runMuse(['exec', '--fail'], 5000),
      (error: Error) => !error.message.includes(fakeKey) && error.message.includes('[REDACTED]'),
    );
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousKey === undefined) delete process.env.MUSE_API_KEY;
    else process.env.MUSE_API_KEY = previousKey;
    await rm(directory, { recursive: true, force: true });
  }
});
