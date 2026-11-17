# LightningChart LA

LightningChart LA brings LightningChart JS to native client applications through
a shared binary transport and browser rendering host.

For more information, please refer to the [online documentation](https://lightningchart.com/lc-la/docs/)
The following reading material is purely intended for developers of LC LA.

## Local development

Use one private root `.env` when testing unreleased changes to the client
libraries. Copy `.env.example` to `.env`, add a free LightningChart JS trial
key or existing commercial key, then run:

```bash
npm install
npm run dev
```

The interactive runner asks to choose a client, then which example to launch, builds the local host,
selects the matching local client library, and supplies the license only to
that process. Example projects always reference the released packages; for
C# examples, `examples/Directory.Build.targets` swaps in the local library when
`-p:LclaUseLocalSource=true` is passed (the runner does this).

### Examples

Examples are grouped by client under `examples/`, with each example in its own
project folder. Each project's README explains how to run it locally.

From the repository root:

```bash
npm run dev                                  # choose a client and example to run
npm run verify:examples                      # build all supported examples against local client libraries
npm run verify:examples -- ExampleName       # build one registered example (replace `ExampleName` with its `name` in `scripts/examples.mjs`)
```

## Release

1. For a major or minor release: set `releaseLine` in `versions.json`, and add the version entry to `CHANGELOG.md`. Patch releases skip this step.
   - Do not edit `packages` in `versions.json` manually!
2. Run `bash scripts/release.sh` and select targets. Each client gets the next patch on `releaseLine`, bundles a fresh host build, and is published.
3. Commit and push the changed version files.
4. If documentation was selected, copy `docs/build` to the deployment server.

If a single target fails, already published targets stay published; re-run and select only the remaining ones.
