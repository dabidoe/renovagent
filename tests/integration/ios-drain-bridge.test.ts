import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { drainTraceHandler } from '../../scripts/ios-drain-bridge.js';

test('the private drain bridge only spends on authenticated frames and returns image-space mask samples', async () => {
  const text = await readFile(
    new URL('../fixtures/sam/before-pillow.txt', import.meta.url),
    'utf8',
  );
  let calls = 0;
  const handler = drainTraceHandler('test-token', async ({ image, phrase }) => {
    calls++;
    assert.equal(image.mediaType, 'image/jpeg');
    assert.equal(phrase, 'exposed drain pipe');
    return { text, runId: 'fixture-run', model: 'fixture-model' };
  });

  async function send(authorization: string, bytes: Buffer) {
    const request = {
      method: 'POST',
      url: '/trace',
      headers: {
        authorization,
        'content-type': 'image/jpeg',
        'content-length': bytes.length.toString(),
      },
      async *[Symbol.asyncIterator]() {
        yield bytes;
      },
    };
    let status = 0;
    let body = '';
    await handler(
      request as unknown as IncomingMessage,
      {
        writeHead(code: number) {
          status = code;
        },
        end(value: string) {
          body = value;
        },
      } as unknown as ServerResponse,
    );
    return { status, body };
  }

  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.equal((await send('Bearer wrong', jpegHeader)).status, 401);
  assert.equal((await send('Bearer test-token', Buffer.from('bad frame'))).status, 400);
  assert.equal(calls, 0);

  const { status, body } = await send('Bearer test-token', jpegHeader);
  assert.equal(status, 200);
  assert.equal(calls, 1);
  const response: { runId: string; width: number; height: number; masks: number[][][] } =
    JSON.parse(body);
  assert.equal(response.runId, 'fixture-run');
  assert.ok(response.width > 0 && response.height > 0);
  const samples = response.masks.flat();
  assert.ok(samples.length > 0);
  for (const [x, y] of samples) {
    assert.ok(x >= 0 && x < response.width && y >= 0 && y < response.height);
  }
});
