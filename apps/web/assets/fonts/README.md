# Fonts

Vendored only for the OG share cards that `scripts/og-card.mjs` rasterises at
build time. The site itself still loads its webfonts the normal way — nothing
here ships to the browser.

| File | Family | Source |
| --- | --- | --- |
| `schibsted-grotesk-latin-800-normal.woff` | Schibsted Grotesk 800 | Google Fonts |
| `karla-latin-400-normal.woff` | Karla 400 | Google Fonts |
| `karla-latin-600-normal.woff` | Karla 600 | Google Fonts |

Both families are licensed under the SIL Open Font License 1.1, which permits
redistribution and embedding: <https://openfontlicense.org>.

Satori cannot read WOFF2, which is why these are WOFF. They are latin-subset,
so a card only ever renders what the sources actually publish.
