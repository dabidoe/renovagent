// Store searches for a described item: never a specific product, price or
// stock claim. Amazon carries the site's Associates tag only when the server
// has one configured, and the page then shows the required disclosure.
export type ShopLink = { store: string; href: string };

export function shopLinks(description: string, amazonTag?: string): ShopLink[] {
  const q = encodeURIComponent(description.trim());
  const amazon = new URL('https://www.amazon.com/s');
  amazon.searchParams.set('k', description.trim());
  if (amazonTag) amazon.searchParams.set('tag', amazonTag);
  return [
    { store: 'Amazon', href: amazon.toString() },
    { store: 'Wayfair', href: `https://www.wayfair.com/keyword.php?keyword=${q}` },
    { store: 'Target', href: `https://www.target.com/s?searchTerm=${q}` },
  ];
}

export const AMAZON_DISCLOSURE =
  'As an Amazon Associate, Renovagent earns from qualifying purchases.';
