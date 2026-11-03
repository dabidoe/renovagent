# UI thumbnails

Generated offline from committed example photos and finish swatches with
`node --import tsx scripts/prepare-ui-thumbnails.ts` and the existing local
`agent-media optimize-web` tool. These WebP derivatives serve only selector,
gallery and swatch images; main photos, 3D floor textures and full-resolution
exports retain their original sources. No source downloads or model calls.

Filenames identify the source bytes and conversion recipe. The generated
`apps/web/src/features/house-example/ui-thumbnails.ts` maps exact bundled paths;
private uploads and unknown paths fall back to their original URLs.
