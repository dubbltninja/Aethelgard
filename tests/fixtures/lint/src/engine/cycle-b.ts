import { a } from './cycle-a';

export const b = (): number => (a.length > 0 ? 1 : 0);
