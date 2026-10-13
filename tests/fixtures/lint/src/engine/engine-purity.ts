import React from 'react';
import { readFileSync } from 'node:fs';

export function impure(): number {
  const roll = Math.random();
  const now = Date.now();
  const when = new Date();
  const width = window.innerWidth;
  setTimeout(() => undefined, 1);
  const store = localStorage.getItem('x');
  const t = performance.now();
  return roll + now + when.getTime() + width + (store ? 1 : 0) + t + (React ? 1 : 0) + readFileSync.length;
}
