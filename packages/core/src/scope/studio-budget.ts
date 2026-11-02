import { studioItemSchema, type StudioItem } from '@renovagent/contracts';

// Owner-entered allowances only. A saved search or generated object never
// becomes a product price; unknown quantity or allowance stays unpriced.
export function studioItemBudget(items: StudioItem[]) {
  let allowanceMinor = 0;
  let unpriced = 0;
  let kept = 0;
  const lines = items.map((raw) => {
    const item = studioItemSchema.parse(raw);
    const totalMinor =
      item.action !== 'keep' && item.quantity !== null && item.unitAllowanceMinor !== null
        ? item.quantity * item.unitAllowanceMinor
        : null;
    if (item.action === 'keep') kept++;
    else if (totalMinor === null) unpriced++;
    else allowanceMinor += totalMinor;
    return { id: item.id, totalMinor };
  });
  return { allowanceMinor, unpriced, kept, lines };
}
