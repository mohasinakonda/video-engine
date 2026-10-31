import { describe, expect, it } from 'vitest';
import { wavDurationSec } from './media-storage';

/** A 16-bit mono WAV header (plus an optional extra chunk) followed by `seconds` of silence. */
function wav(seconds: number, { sampleRate = 24000, dataSize, extraChunk = false }: { sampleRate?: number; dataSize?: number; extraChunk?: boolean } = {}): Blob {
  const pcmBytes = Math.round(seconds * sampleRate * 2);
  const extra = extraChunk ? 8 + 4 : 0;
  const view = new DataView(new ArrayBuffer(44 + extra));
  const text = (at: number, s: string) => Array.from(s).forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + extra + pcmBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  let at = 36;
  if (extraChunk) {
    text(at, 'LIST');
    view.setUint32(at + 4, 4, true);
    at += 12;
  }
  text(at, 'data');
  view.setUint32(at + 4, dataSize ?? pcmBytes, true);
  return new Blob([view.buffer, new Uint8Array(pcmBytes)]);
}

describe('wavDurationSec', () => {
  it('reads the length from the header', async () => {
    expect(await wavDurationSec(wav(2.5))).toBeCloseTo(2.5);
    expect(await wavDurationSec(wav(1, { extraChunk: true }))).toBeCloseTo(1);
  });

  it('uses the rest of the file when a streamed WAV leaves the size unset', async () => {
    expect(await wavDurationSec(wav(3, { dataSize: 0xffffffff }))).toBeCloseTo(3);
  });

  it('returns null for anything that isn’t a WAV', async () => {
    expect(await wavDurationSec(new Blob([new Uint8Array([0x49, 0x44, 0x33, 0, 0, 0, 0, 0, 0, 0, 0, 0])]))).toBeNull();
  });
});
