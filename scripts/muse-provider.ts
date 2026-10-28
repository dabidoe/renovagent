// Node-only boundary. Never import this module into the web app.
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
export async function configuredMuseKey() {
  if (process.env.MUSE_API_KEY?.trim()) return process.env.MUSE_API_KEY.trim();
  for (const relative of ['../server/.env', '../.env']) {
    try {
      const vars = parseEnv(
        await readFile(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'),
      );
      if (vars.MUSE_API_KEY?.trim()) return vars.MUSE_API_KEY.trim();
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return undefined;
}
export async function runMuse(args: string[], timeoutMs = 180000) {
  const key = await configuredMuseKey();
  return new Promise<string>((resolve, reject) => {
    const child = spawn('muse', key ? [...args, '--api-key-stdin'] : args, {
      stdio: [key ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: { ...process.env, MUSE_NO_AUTO_UPDATE: '1' },
    });
    if (key) {
      child.stdin?.on('error', () => {});
      child.stdin?.end(key + '\n');
    }
    let output = '',
      errorOutput = '',
      failure: Error | undefined;
    const redact = (value: string) => (key ? value.split(key).join('[REDACTED]') : value);
    const timer = setTimeout(() => {
      failure = Error('Muse job timed out; no result imported');
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout!.on('data', (data) => {
      output += data.toString();
      if (output.length > 8 * 1024 * 1024) {
        failure = Error('Muse output exceeded limit');
        child.kill('SIGTERM');
      }
    });
    child.stderr!.on('data', (data) => {
      errorOutput = (errorOutput + redact(data.toString())).slice(-4000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(Error(redact(error.message)));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (failure || code !== 0) reject(failure || Error(`Muse exited ${code}: ${errorOutput}`));
      else resolve(redact(output));
    });
  });
}
