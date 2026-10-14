#!/usr/bin/env node
// Builds examples in their repository folders against local client libraries.

import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec, root, selectExamples } from './examples.mjs'

const flutterPackage = resolve(root, 'packages/clients/flutter/lightning_chart_flutter')

function buildExample(example, directory) {
    for (const [command, ...args] of example.steps) {
        if (command === 'dotnet' && args[0] === 'build') {
            exec(command, ['build', example.project, ...args.slice(1), '-p:LclaUseLocalSource=true'], { cwd: directory })
        } else {
            exec(command, args, { cwd: directory })
        }
    }
}

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
        buildExample(example, directory)
    } finally {
        // Remove only the override created by this verification.
        if (!alreadyExists) rmSync(overridePath, { force: true })
    }
}

export function verifyExamples(selected) {
    const failures = []
    for (const example of selected) {
        if (example.platform && example.platform !== process.platform) {
            console.log(`\n${example.name}: skipped (requires ${example.platform})`)
            continue
        }
        const directory = resolve(root, example.directory)
        console.log(`\nBuilding ${example.name} against the local library`)
        try {
            if (!existsSync(directory)) throw new Error(`Example directory not found: ${directory}`)
            if (example.client === 'flutter') {
                buildFlutterExample(example, directory)
            } else {
                buildExample(example, directory)
            }
            console.log(`${example.name}: OK`)
        } catch (error) {
            console.error(`${example.name}: FAILED — ` + (error instanceof Error ? error.message : String(error)))
            failures.push(example.name)
        }
    }
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
        // Process the Flutter client library.
        if (task === 'prepare') {
            exec('flutter', ['pub', 'get'], { cwd: flutterPackage })
            exec('flutter', ['pub', 'get'], { cwd: resolve(flutterPackage, 'example') })
        } else if (task === 'format') {
            exec('dart', ['format', 'lib', 'test', 'example/lib'], { cwd: flutterPackage })
        } else {
            exec('flutter', ['pub', 'get'], { cwd: flutterPackage })
            exec('flutter', ['analyze'], { cwd: flutterPackage })
        }
        // Process every registered Flutter example.
        for (const example of selected.filter(example => example.client === 'flutter')) {
            const directory = resolve(root, example.directory)
            if (!existsSync(directory)) throw new Error(`Example directory not found: ${directory}`)
            console.log(`\n${task}: ${example.name}`)
            const taskExample = { ...example, steps: exampleSteps[task] }
            if (task === 'format') buildExample(taskExample, directory)
            else buildFlutterExample(taskExample, directory)
        }
    } else {
        // Existing example verification.
        exec('npm', ['run', 'build:host'], { cwd: root })
        const failures = verifyExamples(selected)
        if (failures.length > 0) {
            console.error(`\nVerification failed: ${failures.join(', ')}`)
            process.exitCode = 1
        } else {
            console.log('\nVerification completed successfully.')
        }
    }
}