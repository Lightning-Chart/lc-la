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
that process. This workflow is for repository development; example projects
remain configured to consume their released packages by default.

## Release

Run:

```bash
bash scripts/release.sh
```

The release process is interactive. Root `versions.json` records the shared major/minor release line and the current published version of every package. Each selected package calculates its own next patch on that line and records it only after publication succeeds. The root changelog covers major and minor releases; client packages maintain any required patch entries. Update `releaseLine` before a coordinated major or minor release.
