import { z } from 'zod';
export const id = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/)
  .refine(
    (v) => !['prototype', ...Object.getOwnPropertyNames(Object.prototype)].includes(v),
    'Reserved identifier',
  );
export const revision = z.number().int().nonnegative();
export const ref = z
  .object({ kind: z.enum(['fact', 'artifact', 'evidence']), id, revision: revision.min(1) })
  .strict();
export type InputRef = z.infer<typeof ref>;
export const stamp = z.string().datetime();
