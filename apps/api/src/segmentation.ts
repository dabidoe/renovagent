import {
  decodeMaskToRaster,
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
} from '@meta-sam/parser';

// One object SAM 3.1 found for a phrase. `path` is the mask outline in mask
// raster units; draw it with translate(left, top) scale(scaleX, scaleY) inside
// an SVG whose viewBox is the source image size. `imageShare` is the fraction
// of the photo's pixels the mask covers: a visual share, never an area.
export type PhotoSegment = {
  id: string;
  confidence?: number;
  box: { left: number; top: number; right: number; bottom: number };
  path: string;
  scaleX: number;
  scaleY: number;
  imageShare: number;
};
export type PhotoSegmentation = {
  phrase: string;
  width: number;
  height: number;
  segments: PhotoSegment[];
};

export async function parseSegmentation(phrase: string, text: string): Promise<PhotoSegmentation> {
  const size = /;w=(\d+);h=(\d+)/.exec(text);
  if (!text || !size) return { phrase, width: 0, height: 0, segments: [] };
  const width = Number(size[1]),
    height = Number(size[2]);
  async function* events() {
    yield {
      type: 'response.output_text.done',
      item_id: 'sam',
      output_index: 0,
      content_index: 0,
      text,
    };
    yield { type: 'response.completed' };
  }
  const parsed = await parseImageStream(events()).finalResult;
  if (parsed.diagnostics.some((d) => d.severity === 'error'))
    throw Error('SAM output could not be parsed');
  const segments = recordsOfKind(parsed.records, 'mask').map((record) => {
    const { mask, bounds } = record;
    const raster = decodeMaskToRaster(mask);
    let on = 0;
    for (const value of raster) on += value;
    const scaleX = (bounds.right - bounds.left) / mask.width,
      scaleY = (bounds.bottom - bounds.top) / mask.height;
    return {
      id: record.objectId,
      ...(record.confidence === undefined ? {} : { confidence: record.confidence }),
      box: { ...bounds },
      path: decodeMaskToSVGPath(mask),
      scaleX,
      scaleY,
      imageShare: (on * scaleX * scaleY) / (width * height),
    };
  });
  return { phrase, width, height, segments };
}
