#!/usr/bin/env node
// Builds each example from a clean copy outside the monorepo, exactly as a user who cloned the
// standalone repository would.
//
//   npm run verify:examples [-- <example>...]          against the published packages
//   npm run verify:examples -- --local [<example>...]  against locally packed, unpublished packages

import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
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
    if (example.client === 'flutter') {
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

// Runs Flutter tasks against the local client, preserving existing overrides
function buildFlutterExample(example, directory) {
    const overridePath = resolve(directory, 'pubspec_overrides.yaml')
    const packagePath = relative(directory, flutterPackage).replaceAll('\\', '/')
    const override = 'dependency_overrides:\n' + '  lightning_chart_flutter:\n' + `    path: ${packagePath}\n`
    const alreadyExists = existsSync(overridePath)
    // Preserve existing overrides. Only accept the expected local configuration.
    if (alreadyExists && readFileSync(overridePath, 'utf8') !== override) {
        throw new Error(`${overridePath} contains a different configuration. ` + 'Verification will not overwrite it.')
    }
    if (!alreadyExists) writeFileSync(overridePath, override)
    try {
        for (const [command, ...args] of example.steps) {
            exec(command, args, { cwd: directory })
        }
    } finally {
        if (!alreadyExists) rmSync(overridePath, { force: true })
    }
}

export const verifyExamples = (selected, { local = false } = {}) => {
    const failures = []
    const runnable = selected.filter((example) => !example.platform || example.platform === process.platform)
    const localCsharp = local && runnable.some((example) => example.client !== 'flutter') ? packLocalCsharp() : undefined

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

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const args = process.argv.slice(2)
    const taskArgument = args.find(arg => arg.startsWith('--flutter-task='))
    const names = args.filter(arg => arg !== '--local' && arg !== taskArgument)
    const selected = selectExamples(names)
    if (taskArgument !== undefined) {
        const task = taskArgument.slice('--flutter-task='.length)
        const exampleSteps = {
            prepare: [['flutter', 'pub', 'get']],
            format: [['dart', 'format', 'lib']],
            analyze: [['flutter', 'pub', 'get'], ['flutter', 'analyze', 'lib']],
        }
        if (!Object.hasOwn(exampleSteps, task)) throw new Error('Flutter task must be prepare, format, or analyze.')
        // Process the Flutter client library and its bundled example.
        if (task === 'prepare') {
            exec('flutter', ['pub', 'get'], { cwd: flutterPackage })
            exec('flutter', ['pub', 'get'], {
                cwd: resolve(flutterPackage, 'example'),
            })
        } else if (task === 'format') {
            exec('dart', ['format', 'lib', 'test', 'example/lib'], {
                cwd: flutterPackage,
            })
        } else {
            exec('flutter', ['pub', 'get'], { cwd: flutterPackage })
            exec('flutter', ['analyze'], { cwd: flutterPackage })
        }
        // Process every registered Flutter example.
        for (const example of selected.filter(example => example.client === 'flutter')) {
            const directory = resolve(root, 'examples', example.client, example.name)
            if (!existsSync(directory)) throw new Error(`Example directory not found: ${directory}`)
            console.log(`\n${task}: ${example.name}`)
            const taskExample = { ...example, steps: exampleSteps[task] }
            if (task === 'format') {
                for (const [command, ...taskArgs] of taskExample.steps) {
                    exec(command, taskArgs, { cwd: directory })
                }
            } else {
                buildFlutterExample(taskExample, directory)
            }
        }
    } else {
        // Original standalone verification.
        const local = args.includes('--local')
        if (local) exec('npm', ['run', 'build:host'], { cwd: root })
        const failures = verifyExamples(selected, { local })
        if (failures.length > 0) {
            console.error(`\nVerification failed: ${failures.join(', ')}`)
            process.exit(1)
        }
        console.log(`\nAll examples build against the ${local ? 'local' : 'published'} dependencies.`)
    }
}