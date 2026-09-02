When working on actual LightningChart JS (NPM library) API, pull up the "lightningchart" MCP server (if not already done before)

# LightningChart LA

Language Agnostic data visualization. Brings LightningChart JS to non-JS runtimes via WebView/browser embedding + native client libraries.

## Architecture

- `packages/host/` - TypeScript host library. Runs in browser alongside LCJS (`@lightningchart/lcjs`). Receives BIJ messages, maps high-level commands to LCJS API internally.
- `packages/clients/csharp/` - C# client library. Sends BIJ messages. Initially targets Blazor Server.
- `examples/` - Per-framework example projects. Each must have a README.md with instructions to run locally.

## Protocol

ALL messages use Binary Interleaved JSON (BIJ). One protocol, no separate JSON path. Three message categories:

- `lifecycle` - create/destroy **charts** (NOT individual LCJS objects)
- `config` - configure chart appearance/channels (host creates LCJS series/axes internally)
- `data` - push historical or streaming data to channels

## API Philosophy

- LCLA API is HIGHER LEVEL than LCJS. Users think in charts, channels, and data. Do NOT expose LCJS internals (series, axes, cursors, legends).
- Keep API surface small and focused on key use cases.
- Maintain symmetry across client languages (same concepts, adapted to language idioms).
- Layout is always controlled by native UI components; expose a reusable `LclaContext` only in clients that can share its LCJS context, transport, and datasets across charts without compromising native layout, otherwise each chart owns the complete chart and dataset API.

## License

- LightningChart JS requires a license key. This is the **most important** part of the API. Public docs must frame this as an easy free-trial or existing-commercial-key path.
- Every client requires an `LclaLicense` with the key. No client can work without it.
- License also supports optional `licenseInformation` (appTitle, company) for app deployment licenses.
- License config lives in `.env` at repo root (gitignored). `.env.example` is the template.
- Examples load `.env` automatically at startup.

## Data

- Always use `DataSetXY` with `setMaxSampleCount` - no special-casing for data size.
- `setMaxSampleCount` can only define or increase the max, NEVER reduce it (LCJS will crash). Always check `getMaxSampleCount()` before calling.
- Targets: 100s of millions historical points (multi-channel), 1M samples/sec streaming.
- BIJ codec must be exposed publicly so users can use it in their own data endpoints (direct data fetch mode uses the same protocol).

## Validation

Run `npm test` after ANY change. Fix issues before committing.

```
npm test              # runs all validation (host + csharp + flutter)
npm run test:host     # host only: typecheck + vitest + build
npm run test:csharp   # csharp only: dotnet build + dotnet test
npm run test:flutter  # flutter only: flutter test
```

If you change BIJ encoding, update BOTH host and C# implementations and run `npm test`.

## Transport

- **ALWAYS use binary transport. NEVER encode messages as base64 strings.** Messages are `byte[]` / `ArrayBuffer` / `Uint8Array` end-to-end. Base64 is forbidden at every layer - C# transport, JS interop, queue storage, everything. In Blazor, pass `byte[]` directly to `InvokeAsync`/`InvokeVoidAsync`; .NET 8 optimized byte array interop delivers it as `Uint8Array` to JS with no encoding overhead.

## Conventions

- TypeScript: strict mode, no `any`
- C#: .NET 8, PascalCase public API, nullable reference types enabled
- BIJ encoding must match exactly between host and all client implementations
- No codegen. Client APIs are hand-written.
- No CI pipelines, E2E tests, or pre-commit hooks. Agent instructions here are the validation strategy.
- **C# API methods MUST use options objects** - never positional parameters that could grow. Each method takes a single strongly-typed options class (e.g., `SetDataOptions`, `SetAxisIntervalOptions`) with `required` properties for mandatory fields and nullable properties for optional ones. This allows adding new optional properties without breaking existing callers. `CancellationToken` stays as a separate trailing parameter. Methods taking a single list of already-structured configs (like `ConfigureDataSetsAsync(IReadOnlyList<DataSetConfig>)`) are exempt.

## Examples

- Each example must be a standalone, IDE-openable project referencing monorepo client libs via local path.
- Each example MUST have a `README.md` with step-by-step instructions to build and run it locally.
- Each example MUST demonstrate both historical data loading and real-time streaming.
- Examples must use data volumes that showcase LCLA's strength: 1M+ points for historical, 10k+ samples per streaming batch. Never use toy data sizes (100s or 1000s of points).
- When adding a new example, add its wwwroot (or equivalent static assets) path to the `copy:host` script in the root `package.json` so `npm run build:host` copies the bundle to all examples.

## Documentation

- The single user-facing documentation site lives in `website/` and is built with Docusaurus.
- Public documentation must describe only the user-facing path. Never mention, contrast with, or reassure readers about internal tooling, repository workflows, agent decisions, or removed alternatives unless that information is required for the user to complete the documented task.
- Write public documentation with release-ready, customer-facing language. Do not mention unpublished/internal states like "after the package is published"; if docs describe package-manager installation, the release process must make that installation path real before the docs are published.
- Treat public docs and package READMEs as product onboarding and technical marketing material. Every sentence must help a first-time evaluator install, run, understand value, or resolve a real concern.
- Keep installation sections direct: show the command, then move on. Do not add filler that merely restates what the command does or where the package registry is.
- Reduce perceived setup effort. Lead with the fastest working path, especially Flutter Web/Chrome for Flutter examples, and avoid requirements wording that creates unnecessary anxiety.
- Avoid repeating the same setup concern across adjacent sections. Put a requirement, license step, or platform note where it helps the user act, then do not restate it as filler.
- Before finishing documentation changes, reread the touched public page as a skeptical first-time user. Delete or rewrite any sentence that is obvious, internally focused, repetitive, or likely to make setup feel harder than it is.
- Keep client docs focused on client-specific installation, minimal working usage, platform requirements, dependencies, and troubleshooting.
- In a client-specific documentation page, use only that client’s product name (for example, LightningChart C# or LightningChart Flutter); never refer to LightningChart JS or LightningChart LA in prose.
- Keep example READMEs focused on cloning, installing, running, and operating the example locally. Do not let examples become product documentation.
- When changing a client API or example behavior, update the matching Docusaurus client page and example README in the same change.

### Client-specific documentation pages

For example, /docs/clients/csharp

These client-specific pages should have symmetric structure and content, according to following design:

- how to install the client library
- link to relevant example (GitHub project) also mention that its own Readme should walk through running it locally
- how to pass license key to client library API
- minimal snippet how to make a line chart from historical data
- minimal snippet how to make a line chart from real-time data
  FOR SNIPPETS, ALWAYS CONSIDER HOW DATA (BE IT HISTORICAL OR REAL-TIME) WOULD NORMALLY BE ACQUIRED IN THE SPECIFIC FRAMEWORK
- "more features" section - tell that all LCLA clients support the same underlying features. The documentation is kept lean by introducing the general syntax and key use cases per client, for more details refer to the client agnostic Features section: link
- ending section, if user found any bugs or has ideas what could be added, inform of open source path (can add it themselves) or contact LightningChart developers. Use same structure as in overview index page.

## Versioning and releases

To release a new version, refer to README.md
