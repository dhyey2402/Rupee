/**
 * Web Audio API utilities for Gemini Live API (gemini-3.8-live).
 * - Input: 16kHz 16-bit Linear PCM Little-Endian
 * - Output: 24kHz 16-bit Linear PCM Little-Endian playback
 */

// Convert Float32 audio samples (-1.0 to 1.0) to 16-bit Linear PCM Base64 string
export function floatTo16BitPcmBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  // Base64 encode
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return window.btoa(binary);
}

// Convert Base64 16-bit Linear PCM to Float32Array for Web Audio playback
export function base64PcmToFloat32(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const view = new DataView(bytes.buffer);
  const sampleCount = bytes.length / 2;
  const float32 = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
  }

  return float32;
}

// Live audio session manager class
export class LiveAudioPlayer {
  private outputCtx: AudioContext | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor() {
    // 24kHz sample rate matches Gemini Live API model output
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        this.outputCtx = new AudioCtx({ sampleRate: 24000 });
      } catch (e) {
        this.outputCtx = new AudioCtx();
      }
    }
  }

  public async resume() {
    if (this.outputCtx && this.outputCtx.state === 'suspended') {
      await this.outputCtx.resume();
    }
  }

  public playChunk(base64Pcm: string, onLevel?: (level: number) => void) {
    if (!this.outputCtx) return;
    this.resume();

    const samples = base64PcmToFloat32(base64Pcm);
    if (samples.length === 0) return;

    // Optional audio volume level calculation for visualizer
    if (onLevel) {
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sum / samples.length);
      onLevel(Math.min(1, rms * 5));
    }

    const buffer = this.outputCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = this.outputCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputCtx.destination);

    const currentTime = this.outputCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.05; // tiny buffer for jitter
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx > -1) this.activeSources.splice(idx, 1);
    };
  }

  public interrupt() {
    // Stop all playing and scheduled sources
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch (e) {}
    }
    this.activeSources = [];
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    }
  }

  public close() {
    this.interrupt();
    if (this.outputCtx) {
      this.outputCtx.close();
      this.outputCtx = null;
    }
  }
}
