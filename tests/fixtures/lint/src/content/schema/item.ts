import { z } from 'zod';

export const ItemSchema = z.object({ id: z.string() });
export type ItemSchema = z.infer<typeof ItemSchema>;
