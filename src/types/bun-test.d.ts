// `bun:test` type surface (PLAN §3.7, D-065). The `bun-types` package is not installed (npm registry blocked), so
// the repo declares the test API it uses. Adding a matcher or helper means adding its declaration here.

declare module 'bun:test' {
  type MaybePromise = void | Promise<unknown>;
  type TestFn = () => MaybePromise;
  type EachArgs<T> = T extends readonly unknown[] ? T : [T];

  interface TestOptions {
    timeout?: number;
    retry?: number;
    repeats?: number;
  }

  export interface Test {
    (name: string, fn: TestFn, timeoutOrOptions?: number | TestOptions): void;
    /** Focused test — declared for completeness; the lint rule `no-focused-tests` rejects it in the repo. */
    only(name: string, fn: TestFn, timeoutOrOptions?: number | TestOptions): void;
    skip(name: string, fn?: TestFn, timeoutOrOptions?: number | TestOptions): void;
    todo(name: string, fn?: TestFn): void;
    if(condition: boolean): (name: string, fn: TestFn, timeoutOrOptions?: number | TestOptions) => void;
    skipIf(condition: boolean): (name: string, fn: TestFn, timeoutOrOptions?: number | TestOptions) => void;
    each<T>(
      table: readonly T[],
    ): (name: string, fn: (...args: EachArgs<T>) => MaybePromise, timeoutOrOptions?: number | TestOptions) => void;
  }

  export interface Describe {
    (name: string, fn: () => void): void;
    only(name: string, fn: () => void): void;
    skip(name: string, fn: () => void): void;
    todo(name: string, fn?: () => void): void;
    if(condition: boolean): (name: string, fn: () => void) => void;
    skipIf(condition: boolean): (name: string, fn: () => void) => void;
    each<T>(table: readonly T[]): (name: string, fn: (...args: EachArgs<T>) => void) => void;
  }

  export const test: Test;
  export const it: Test;
  export const describe: Describe;

  export function beforeAll(fn: TestFn): void;
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;
  export function afterAll(fn: TestFn): void;

  type ErrorClass = new (...args: any[]) => Error;

  export interface Matchers<R = void> {
    readonly not: Matchers<R>;
    readonly resolves: Matchers<Promise<void>>;
    readonly rejects: Matchers<Promise<void>>;
    toBe(expected: unknown): R;
    toEqual(expected: unknown): R;
    toStrictEqual(expected: unknown): R;
    toBeDefined(): R;
    toBeUndefined(): R;
    toBeNull(): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toBeNaN(): R;
    toBeInstanceOf(expected: ErrorClass | (new (...args: any[]) => unknown)): R;
    toContain(expected: unknown): R;
    toContainEqual(expected: unknown): R;
    toHaveLength(length: number): R;
    toHaveProperty(path: string | readonly (string | number)[], value?: unknown): R;
    toMatch(expected: string | RegExp): R;
    toMatchObject(expected: object): R;
    toThrow(expected?: string | RegExp | Error | ErrorClass): R;
    toBeGreaterThan(expected: number | bigint): R;
    toBeGreaterThanOrEqual(expected: number | bigint): R;
    toBeLessThan(expected: number | bigint): R;
    toBeLessThanOrEqual(expected: number | bigint): R;
    toBeCloseTo(expected: number, numDigits?: number): R;
    toMatchSnapshot(hint?: string): R;
    toMatchInlineSnapshot(snapshot?: string): R;
    toHaveBeenCalled(): R;
    toHaveBeenCalledTimes(times: number): R;
    toHaveBeenCalledWith(...args: unknown[]): R;
    toHaveBeenLastCalledWith(...args: unknown[]): R;
  }

  export interface Expect {
    (actual: unknown, message?: string): Matchers;
    assertions(count: number): void;
    hasAssertions(): void;
    unreachable(message?: string): never;
  }
  export const expect: Expect;

  type AnyFn = (...args: any[]) => any;

  export interface MockResult {
    type: 'return' | 'throw' | 'incomplete';
    value: unknown;
  }
  export interface Mock<T extends AnyFn = AnyFn> {
    (...args: Parameters<T>): ReturnType<T>;
    readonly mock: {
      readonly calls: Parameters<T>[];
      readonly results: MockResult[];
    };
    mockImplementation(fn: T): Mock<T>;
    mockImplementationOnce(fn: T): Mock<T>;
    mockReturnValue(value: ReturnType<T>): Mock<T>;
    mockReturnValueOnce(value: ReturnType<T>): Mock<T>;
    mockClear(): Mock<T>;
    mockReset(): Mock<T>;
    mockRestore(): void;
  }

  export function mock<T extends AnyFn>(fn?: T): Mock<T>;
  export function spyOn<O extends object, K extends keyof O>(
    object: O,
    method: K,
  ): O[K] extends AnyFn ? Mock<O[K]> : never;
}
