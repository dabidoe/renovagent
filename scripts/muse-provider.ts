// Node-only boundary. Never import this module into the web app.
import { AsyncLocalStorage } from 'node:async_hooks';
const execution = new AsyncLocalStorage<{ signal: AbortSignal; remaining: number }>();
export const withMuseBudget = <T>(signal: AbortSignal, calls: number, fn: () => Promise<T>) =>
  execution.run({ signal, remaining: calls }, fn);
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectEnvFiles } from '../apps/api/src/database-config.js';
// The environment, else the project settings (see projectEnvFiles: this
// checkout, or a worktree's main checkout), resolved from this file's repo.
export async function configuredMuseKey() {
  if (process.env.MUSE_API_KEY?.trim()) return process.env.MUSE_API_KEY.trim();
  const { vars } = await projectEnvFiles({}, fileURLToPath(new URL('..', import.meta.url)));
  return vars.MUSE_API_KEY?.trim() || undefined;
}
export async function runMuse(args: string[], timeoutMs = 180000) {
  const scope = execution.getStore();
  scope?.signal.throwIfAborted();
  if (scope && --scope.remaining < 0) throw Error('Muse call budget exhausted');
  const key = await configuredMuseKey();
  scope?.signal.throwIfAborted();
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
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (killTimer) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    };
    const abort = () => {
      failure = Error('Muse analysis cancelled');
      stop();
    };
    scope?.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      failure = Error('Muse job timed out; no result imported');
      stop();
    }, timeoutMs);
    child.stdout!.on('data', (data) => {
      output += data.toString();
      if (output.length > 8 * 1024 * 1024) {
        failure = Error('Muse output exceeded limit');
        stop();
      }
    });
    child.stderr!.on('data', (data) => {
      errorOutput = (errorOutput + redact(data.toString())).slice(-4000);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      scope?.signal.removeEventListener('abort', abort);
      reject(Error(redact(error.message)));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      scope?.signal.removeEventListener('abort', abort);
      if (failure || code !== 0) reject(failure || Error(`Muse exited ${code}: ${errorOutput}`));
      else resolve(redact(output));
    });
  });
}
