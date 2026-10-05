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
npm run dev
```

The interactive runner asks which example to launch, builds the local host,
selects the matching local client library, and supplies the license only to
that process. Example projects always reference the released packages; for
C# examples, `examples/Directory.Build.targets` swaps in the local library when
`-p:LclaUseLocalSource=true` is passed (the runner does this).

### Examples

Each example is also a standalone repository (`Lightning-Chart/lc-la-example-*`) and must build from a plain clone.

```bash
npm run dev                                  # run an example against local source
npm run verify:examples -- --local           # clean-copy build against the local, unpublished packages
npm run verify:examples                      # clean-copy build against the published packages
npm run sync:examples                        # dry run: what would change in the standalone repos
npm run sync:examples -- --push              # verify against published packages, then push
```

The release scripts do not touch the example repositories. Run these by hand.

## Release

Run:

```bash
bash scripts/release.sh
```

The release process is interactive. Root `versions.json` records the shared major/minor release line and the current published version of every package. Each selected package calculates its own next patch on that line and records it only after publication succeeds. The root changelog covers major and minor releases; client packages maintain any required patch entries. Update `releaseLine` before a coordinated major or minor release.
