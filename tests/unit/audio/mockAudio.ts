// A mock AudioContext for the audio unit tests (U74): it records the graph a sound builds and checks what a real one
// would refuse — non-finite times or values, an exponential ramp to 0 or below, a source started twice or stopped before
// it was started — so "builds without error" means something without speakers.

export class MockParam {
  value: number;
  readonly events: { kind: string; value: number; time: number }[] = [];
  constructor(value = 0) {
    this.value = value;
  }
  private add(kind: string, value: number, time: number): this {
    if (!Number.isFinite(value) || !Number.isFinite(time) || time < 0) throw new RangeError(`${kind}(${value}, ${time})`);
    this.events.push({ kind, value, time });
    this.value = value;
    return this;
  }
  setValueAtTime(v: number, t: number): this {
    return this.add('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number): this {
    return this.add('linear', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    if (v <= 0) throw new RangeError(`exponential ramp to ${v}`);
    return this.add('exp', v, t);
  }
  setTargetAtTime(v: number, t: number, c: number): this {
    if (!(c > 0)) throw new RangeError(`time constant ${c}`);
    return this.add('target', v, t);
  }
  cancelScheduledValues(t: number): this {
    if (!Number.isFinite(t)) throw new RangeError('cancel');
    return this;
  }
  /** The largest value this param is ever set or ramped to. */
  peak(): number {
    return Math.max(this.value, ...this.events.map((e) => e.value));
  }
}

export class MockNode {
  readonly kind: string;
  readonly outputs = new Set<MockNode>();
  disconnected = false;
  constructor(kind: string) {
    this.kind = kind;
  }
  connect<T>(node: T): T {
    this.outputs.add(node as MockNode);
    return node;
  }
  disconnect(): void {
    this.disconnected = true;
    this.outputs.clear();
  }
}

export class MockGain extends MockNode {
  gain = new MockParam(1);
  constructor() {
    super('gain');
  }
}

export class MockSource extends MockNode {
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  type = 'sine';
  buffer: unknown = null;
  frequency = new MockParam(440);
  detune = new MockParam(0);
  onended: (() => void) | null = null;
  start(t = 0): void {
    if (this.startedAt !== null) throw new Error('started twice');
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`start(${t})`);
    this.startedAt = t;
  }
  stop(t = 0): void {
    if (this.startedAt === null) throw new Error('stopped before start');
    if (!Number.isFinite(t)) throw new RangeError(`stop(${t})`);
    this.stoppedAt = this.stoppedAt === null ? t : Math.min(this.stoppedAt, t);
  }
}

export class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 0;
  readonly sampleRate = 8000;
  readonly destination = new MockNode('destination');
  readonly nodes: MockNode[] = [];
  resumes = 0;
  suspends = 0;
  constructor(readonly withPanner = true) {}
  private made<T extends MockNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  createGain(): MockGain {
    return this.made(new MockGain());
  }
  createOscillator(): MockSource {
    return this.made(new MockSource('oscillator'));
  }
  createBufferSource(): MockSource {
    return this.made(new MockSource('buffer'));
  }
  createBiquadFilter(): MockNode & { type: string; frequency: MockParam; Q: MockParam } {
    return this.made(Object.assign(new MockNode('biquad'), { type: 'lowpass', frequency: new MockParam(350), Q: new MockParam(1) }));
  }
  createDelay(): MockNode & { delayTime: MockParam } {
    return this.made(Object.assign(new MockNode('delay'), { delayTime: new MockParam(0) }));
  }
  createDynamicsCompressor(): MockNode & Record<'threshold' | 'knee' | 'ratio' | 'attack' | 'release', MockParam> {
    const p = (): MockParam => new MockParam(0);
    return this.made(Object.assign(new MockNode('compressor'), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() }));
  }
  get createStereoPanner(): (() => MockNode & { pan: MockParam }) | undefined {
    return this.withPanner ? () => this.made(Object.assign(new MockNode('panner'), { pan: new MockParam(0) })) : undefined;
  }
  createBuffer(_channels: number, length: number, _rate: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume(): Promise<void> {
    this.resumes += 1;
    if (this.state !== 'closed') this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspends += 1;
    if (this.state !== 'closed') this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
  sources(): MockSource[] {
    return this.nodes.filter((n): n is MockSource => n instanceof MockSource);
  }
  gains(): MockGain[] {
    return this.nodes.filter((n): n is MockGain => n instanceof MockGain);
  }
}

/** The mock as the engine's `create` option expects it. */
export const asContext = (mock: MockAudioContext): AudioContext => mock as unknown as AudioContext;
