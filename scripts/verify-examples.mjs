#!/usr/bin/env node
// Builds each example from a clean copy outside the monorepo, exactly as a user who cloned the
// standalone repository would.
//
//   npm run verify:examples [-- <example>...]          against the published packages
//   npm run verify:examples -- --local [<example>...]  against locally packed, unpublished packages

import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec, exportExample, root, selectExamples } from './examples.mjs'

const csharpProject = resolve(root, 'packages/clients/csharp/LightningChart.LA/LightningChart.LA.csproj')
const flutterPackage = resolve(root, 'packages/clients/flutter/lightning_chart_flutter')

// Packs the local C# client into a temporary NuGet feed.
const packLocalCsharp = () => {
    const feed = mkdtempSync(join(tmpdir(), 'lcla-feed-'))
    // The release script copies the root changelog into the package; the pack needs it to exist.
    const changelog = resolve(dirname(csharpProject), 'CHANGELOG.md')
    const copiedChangelog = !existsSync(changelog)
    if (copiedChangelog) copyFileSync(resolve(root, 'CHANGELOG.md'), changelog)
    // A unique version keeps NuGet from reusing a cached package that has the same version.
    const version = `0.0.0-local.${Date.now()}`
    try {
        exec('dotnet', ['pack', csharpProject, '-c', 'Release', '-o', feed, `-p:Version=${version}`])
    } finally {
        if (copiedChangelog) rmSync(changelog, { force: true })
    }
    return { feed, version }
}

// Points a clean copy of an example at the local packages instead of the published ones.
const useLocalPackages = (example, directory, localCsharp) => {
    if (example.name === 'flutter') {
        const path = flutterPackage.replaceAll('\\', '/')
        writeFileSync(
            join(directory, 'pubspec_overrides.yaml'),
            `dependency_overrides:\n  lightning_chart_flutter:\n    path: ${path}\n`,
        )
        return
    }
    writeFileSync(
        join(directory, 'nuget.config'),
        `<?xml version="1.0" encoding="utf-8"?>\n<configuration>\n  <packageSources>\n    <add key="local" value="${localCsharp.feed}" />\n  </packageSources>\n</configuration>\n`,
    )
    const projectFile = join(directory, example.project)
    const original = readFileSync(projectFile, 'utf8')
    writeFileSync(
        projectFile,
        original.replace(/(<PackageReference Include="LCLA" Version=")[^"]*(")/, `$1${localCsharp.version}$2`),
    )
}

export const verifyExamples = (selected, { local = false } = {}) => {
    const failures = []
    const runnable = selected.filter((example) => !example.platform || example.platform === process.platform)
    const localCsharp = local && runnable.some((example) => example.name !== 'flutter') ? packLocalCsharp() : undefined

    for (const example of selected) {
        if (!runnable.includes(example)) {
            console.log(`\n== ${example.name}: skipped (requires ${example.platform})`)
            continue
        }
        console.log(`\n== ${example.name}: building a clean copy against the ${local ? 'LOCAL unpublished' : 'published'} package`)
        const directory = mkdtempSync(join(tmpdir(), `lcla-verify-${example.name}-`))
        try {
            exportExample(example, directory)
            if (local) useLocalPackages(example, directory, localCsharp)
            for (const [command, ...args] of example.steps) exec(command, args, { cwd: directory })
            console.log(`== ${example.name}: OK`)
        } catch (error) {
            console.error(`== ${example.name}: FAILED - ${error.message}`)
            failures.push(example.name)
        } finally {
            rmSync(directory, { recursive: true, force: true })
        }
    }
    if (localCsharp) rmSync(localCsharp.feed, { recursive: true, force: true })
    return failures
}

if (realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const argv = process.argv.slice(2)
    const local = argv.includes('--local')
    if (local) exec('npm', ['run', 'build:host'], { cwd: root })
    const failures = verifyExamples(selectExamples(argv.filter((arg) => arg !== '--local')), { local })
    if (failures.length > 0) {
        console.error(`\nVerification failed: ${failures.join(', ')}`)
        process.exit(1)
    }
    console.log(`\nAll examples build against the ${local ? 'local' : 'published'} packages.`)
}
