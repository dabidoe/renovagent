import { useState } from 'react';
import { lineTotalMinor } from '@renovagent/core';
import { projectReferenceSchema, type ProjectReference } from '@renovagent/contracts';
export function referenceFromForm(form: FormData): ProjectReference | null {
  const url = String(form.get('referenceUrl') || '').trim();
  const title = String(form.get('referenceTitle') || '').trim();
  const note = String(form.get('referenceNote') || '').trim();
  const price = String(form.get('referencePrice') || '').trim();
  if (!url && !title && !note && !price) return null;
  return projectReferenceSchema.parse({
    kind: String(form.get('referenceKind') || 'inspiration'),
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(note ? { note } : {}),
    ...(price
      ? { price: { minorUnits: lineTotalMinor(Number(price), 100), currency: 'USD' } }
      : {}),
  });
}
export function ReferenceFields() {
  const [kind, setKind] = useState('inspiration');
  return (
    <div className="reference-fields">
      <label>
        Reference type
        <select name="referenceKind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="inspiration">Inspiration</option>
          <option value="product">Product</option>
        </select>
      </label>
      <label>
        Link
        <input
          name="referenceUrl"
          type="url"
          maxLength={2000}
          placeholder="Pinterest, a store, a designer…"
        />
      </label>
      <label>
        Name <span>optional</span>
        <input
          name="referenceTitle"
          maxLength={200}
          placeholder={
            kind === 'product' ? 'Oak wall-mounted vanity' : 'The bathroom I have in mind'
          }
        />
      </label>
      <label>
        {kind === 'product' ? 'What matters about it?' : 'What do you like about it?'}
        <textarea
          name="referenceNote"
          maxLength={1000}
          rows={2}
          placeholder="The oak finish, the floating vanity, the dark tile…"
        />
      </label>
      {kind === 'product' && (
        <label>
          Price you found <span>USD · optional</span>
          <input
            type="number"
            name="referencePrice"
            min="0"
            max="100000000"
            step="0.01"
            inputMode="decimal"
            placeholder="339.00"
          />
        </label>
      )}
    </div>
  );
}
