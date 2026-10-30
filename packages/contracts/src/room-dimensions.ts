import { z } from 'zod';
import { id } from './common.js';
import { lengthSchema } from './planning.js';

// Room dimensions the person measured themselves. The method records how the
// numbers were taken; it never upgrades them to verified. AR and LiDAR readings
// are estimates the person confirms by saving them.
export const roomMeasureMethodSchema = z.enum(['tape-measure', 'phone-ar-app', 'lidar-scan']);
export const roomMeasureMethodLabels = {
  'tape-measure': 'Tape measure',
  'phone-ar-app': 'Phone AR measuring app',
  'lidar-scan': 'LiDAR room scan',
} as const satisfies Record<z.infer<typeof roomMeasureMethodSchema>, string>;

const positiveLength = lengthSchema.refine((l) => l.amount > 0, 'Length must be greater than zero');

// Fact keys the scope recipes already read (see draft-scope INPUTS).
export const roomDimensionFacts = {
  length: 'finishedLength',
  width: 'finishedWidth',
  height: 'ceilingHeight',
} as const;
export type RoomDimension = keyof typeof roomDimensionFacts;

export const roomDimensionsInputSchema = z
  .object({
    length: positiveLength.nullable(),
    width: positiveLength.nullable(),
    height: positiveLength.nullable(),
    method: roomMeasureMethodSchema,
    notes: z.string().trim().max(2000),
    // Photo evidence already attached to the project.
    photoEvidenceIds: z.array(id).max(5),
  })
  .strict()
  .refine((i) => i.length || i.width || i.height, 'Enter at least one dimension');
export type RoomDimensionsInput = z.infer<typeof roomDimensionsInputSchema>;
export type RoomMeasureMethod = z.infer<typeof roomMeasureMethodSchema>;
