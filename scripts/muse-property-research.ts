import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runMuse } from './muse-provider.js';
import { fileURLToPath } from 'node:url';
import { validateResearchForJob, musePropertyPrompt } from '@unpermitted/core';
export function museResultFromEvents(text: string) {
  let terminal: { terminal?: string; text?: string; reason?: string } | undefined;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.payload_type === 'run.terminal.completed' || record.payload?.kind === 'run_terminal')
      terminal = record.payload;
  }
  if (terminal?.terminal !== 'completed' || !terminal.text)
    throw Error(
      `Muse did not complete this job: ${terminal?.reason || 'no completed terminal event'}`,
    );
  const answer = terminal.text
    .trim()
    .replace(/^```(?:json)?\s*/, '')
    .replace(/\s*```$/, '');
  return JSON.parse(answer);
}
export async function saveMuseResearchResult(
  raw: unknown,
  address: string,
  jobId: string,
  outputFile: string,
) {
  let research;
  try {
    research = validateResearchForJob(raw, address, jobId);
  } catch (error) {
    const diagnostic = `${outputFile}.rejected.json`;
    await writeFile(
      diagnostic,
      JSON.stringify(
        {
          status: 'rejected',
          reason: error instanceof Error ? error.message : String(error),
          result: raw,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    throw Error(
      `Muse result failed validation; nothing imported. Inspect ${diagnostic}. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await writeFile(outputFile, JSON.stringify(research, null, 2) + '\n', { flag: 'wx' });
  return research;
}
export async function runMusePropertyJob(jobFile: string, outputFile: string) {
  const job = JSON.parse(await readFile(jobFile, 'utf8'));
  if (
    job.schemaVersion !== 1 ||
    typeof job.address !== 'string' ||
    job.address.length > 300 ||
    typeof job.jobId !== 'string' ||
    job.jobId.length > 300 ||
    typeof job.goal !== 'string' ||
    job.goal.length > 4000
  )
    throw Error('Unsupported research job. Export a fresh job from the app.');
  // Rebuild the bounded prompt; exported prompt strings are never executable commands.
  const directory = await mkdtemp(join(tmpdir(), 'unpermitted-muse-'));
  try {
    const promptFile = join(directory, 'prompt.md');
    const context =
      job.context === undefined
        ? undefined
        : validateResearchForJob(job.context, job.address, job.jobId);
    await writeFile(promptFile, musePropertyPrompt(job.address, job.goal, job.jobId, context));
    const schemaFile = fileURLToPath(new URL('./property-research.schema.json', import.meta.url));
    const result = await runMuse(
      [
        'exec',
        '--json',
        '--prompt-file',
        promptFile,
        '--output-schema',
        schemaFile,
        '--no-session-log',
        '--disable-shell',
        '--disable-write',
        '--disable-reminders',
        '--no-foreign-personal-context',
        '--max-model-steps',
        '16',
      ],
      300000,
    );
    await saveMuseResearchResult(museResultFromEvents(result), job.address, job.jobId, outputFile);
    console.log(
      `Saved unreviewed sourced research to ${outputFile}. Import it into the matching project; no project facts were changed.`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    job = args[args.indexOf('--job') + 1],
    output = args[args.indexOf('--output') + 1];
  if (!args.includes('--job') || !args.includes('--output') || !job || !output) {
    console.error('Usage: npm run muse:property -- --job job.json --output results.json');
    process.exitCode = 1;
  } else
    await runMusePropertyJob(job, output).catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
