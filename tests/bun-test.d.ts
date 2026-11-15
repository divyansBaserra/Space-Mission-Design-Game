// Ambient type declarations for Bun test runner (zero external dependencies)
declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;

  export interface Matchers<T = unknown> {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeCloseTo(expected: number, numDigits?: number): void;
    toBeTrue(): void;
    toBeFalse(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(expected: string | unknown): void;
    toThrow(error?: unknown): void;
    not: Matchers<T>;
  }

  export function expect<T = unknown>(actual: T): Matchers<T>;
}
