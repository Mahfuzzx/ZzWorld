# Vendored libraries

Third-party code is copied here instead of loaded from a CDN, so the game works
offline and the Content-Security-Policy can block all external connections.

| Library | Version | License | Source |
|---|---|---|---|
| [perfect-freehand](https://github.com/steveruizok/perfect-freehand) | 1.2.2 | MIT | `dist/esm/index.mjs` from the npm package |
| [Rough.js](https://github.com/rough-stuff/rough) | 4.6.6 | MIT | `bundled/rough.esm.js` from the npm package |

Files are unmodified apart from renaming `index.mjs` to `index.js`.
