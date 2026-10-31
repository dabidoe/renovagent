# Landing cost demo — retail references

Checked October 30, 2026. These are public product-page prices in USD, captured for the landing demo. They are not live offers, local inventory promises, a complete bathroom bill of materials, or an installation specification. Taxes, shipping, tools and other project materials are excluded. Quantities are presentation fixtures, not measured project facts. The demo never writes these records into a homeowner project or the catalog.

| Product | Unit reference | Demo quantity | Line total | Price source |
| --- | ---: | ---: | ---: | --- |
| SharkBite U860R25, ½-inch red PEX-B, 25 ft coil | $15.15 | 1 | $15.15 | [SupplyHouse](https://www.supplyhouse.com/SharkBite-U860R25-1-2-Red-Sharkbite-PEX-Tubing-25-ft-Coil) |
| SharkBite UC248LFA, ½-inch brass PEX barb elbow | $2.98 | 8 | $23.84 | [Home Depot](https://www.homedepot.com/p/202270636) |
| VersaBond MTSW50, white thinset mortar, 50 lb | $17.98 | 2 | $35.96 | [Home Depot](https://www.homedepot.com/p/100091767) |
| Polyblend Plus PBPG6010, #60 charcoal unsanded grout, 10 lb | $24.99 | 1 | $24.99 | [Stine](https://www.stinehome.com/home-improvement/paint-supplies/grouts/custom-building-products-polyblend-plus-indoor-and-outdoor-charcoal-non-sanded-grout-10-lb./1003227.html), displayed Sulphur store |
| Backer-On 23401, 1¼-inch cement-board screws, 185 count | $7.52 | 1 | $7.52 | [Home Depot](https://www.homedepot.com/p/300657700) |
| GE Advanced Silicone 2 2812562, clear kitchen/bath sealant, 10.1 oz | $10.98 | 2 | $21.96 | [Home Depot](https://www.homedepot.com/p/317742602) |
| Materials subtotal | | | **$129.42** | |

Product packshots are bundled locally to avoid retailer hotlink failures; each card links to its price source. Exact asset URLs are recorded in [the product asset README](../apps/web/src/assets/products/README.md). Retailer/manufacturer imagery remains third-party product imagery; no ownership or open-license claim is made.

Labor is a separate view. Plumbing uses the owner's requested example of 6 worker-hours at $75/hour ($450); tile prep/installation uses an illustrative 24 worker-hours at $60/hour ($1,440). The UI identifies these as a **labor allowance**, with 30 worker-hours across two trades and $1,890 total. These are not researched local contractor quotes or a promised schedule/crew size. No technical suitability is inferred from product selection.

Totals use `lineTotalMinor` from the shared core. Filtering materials recalculates the visible lines and subtotal; labor is never included on the materials side.
