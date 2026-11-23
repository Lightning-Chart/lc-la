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

Selected examples are also standalone repositories (`Lightning-Chart/lc-la-example-*`) and must build from a plain clone.

```bash
npm run dev                                  # choose and run an example against local source
npm run verify:examples -- --local           # clean-copy build against the local, unpublished packages
npm run verify:examples                      # clean-copy build against the published packages
npm run sync:examples                        # dry run: what would change in the standalone repos
npm run sync:examples -- --push              # verify against published packages, then push
```

The release scripts do not touch the example repositories. Run these by hand.

## Release

1. Use "rc/v0.1" syntax for release branch name
2. For a major or minor release: set `releaseLine` in `versions.json`, and add the version entry to `CHANGELOG.md`. Patch releases skip this step.
   - Do not edit `packages` in `versions.json` manually!
3. Ensure `CHANGELOG.md` is good to go
4. Run `bash scripts/release.sh` and select targets. Each client gets the next patch on `releaseLine`, bundles a fresh host build, and is published.
5. If documentation was selected, copy `docs/build` to the deployment server.
6. After everything has been released and tested to be functioning, commit code changes and create + push a git tag marking the release point in history
   - `git tag v0.1`
   - `git push --tags`

If a single target fails, already published targets stay published; re-run and select only the remaining ones.
