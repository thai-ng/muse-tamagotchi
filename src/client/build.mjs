// Client bundle for the space.
//
// Bundling is owned by the SDK so every space produces an identical
// production-mode React bundle. See @hatch/space-sdk/build for the
// canonical Bun.build() configuration (entrypoint, outdir, NODE_ENV
// define, asset naming, tailwind plugin).
//
// One addition for this artifact: the companion's clip files live in
// client/assets/ and are copied verbatim into dist/assets/ after the
// canonical bundle, so the player's direct relative
// `assets/<name>.webm` URLs resolve (the bundler's hashed asset names
// would break the player's string-built clip paths).

import { cp } from "node:fs/promises";
import { buildClient } from "@hatch/space-sdk/build";

await buildClient();
await cp("./client/assets", "./client/dist/assets", { recursive: true });
