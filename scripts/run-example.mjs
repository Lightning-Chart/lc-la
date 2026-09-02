#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cancel, intro, isCancel, outro, select, spinner } from '@clack/prompts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const dotnetCommand = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet'
const flutterCommand = process.platform === 'win32' ? 'flutter.bat' : 'flutter'

const spawn = (command, args, options = {}) => {
    const isWindowsBatch = process.platform === 'win32' && /\.(?:bat|cmd)$/.test(command)
    return spawnSync(isWindowsBatch ? 'cmd.exe' : command, isWindowsBatch ? ['/d', '/s', '/c', command, ...args] : args, {
        cwd: options.cwd ?? root,
        env: options.env ?? process.env,
        stdio: options.stdio ?? 'inherit',
        shell: false,
    })
}

const run = (command, args, options = {}) => {
    const result = spawn(command, args, options)
    if (result.error) throw result.error
    if (result.status !== 0) {
        throw new Error(`${command} exited with status ${result.status ?? 1}.`)
    }
}

const readEnv = (path) => {
    if (!existsSync(path)) {
        throw new Error('Missing .env. Copy .env.example to .env and add LCJS_LICENSE_KEY.')
    }

    const values = {}
    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const separator = line.indexOf('=')
        if (separator < 1) continue
        const key = line.slice(0, separator).trim()
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
        }
        values[key] = value
    }
    return values
}

intro('LightningChart LA local example runner')

let localValues
try {
    localValues = readEnv(envPath)
} catch (error) {
    cancel(error instanceof Error ? error.message : String(error))
    process.exit(1)
}

const env = { ...localValues, ...process.env }
if (!env.LCJS_LICENSE_KEY || env.LCJS_LICENSE_KEY === 'your-license-key-here') {
    cancel('LCJS_LICENSE_KEY must be set in the root .env.')
    process.exit(1)
}

const target = await select({
    message: 'Choose an example to run with local library sources',
    options: [
        { value: 'blazor-server', label: 'Blazor Server', hint: 'C# client' },
        { value: 'maui', label: '.NET MAUI', hint: 'C# client' },
        { value: 'uno', label: 'Uno Platform', hint: 'C# client' },
        { value: 'flutter', label: 'Flutter', hint: 'Flutter client' },
    ],
})

if (isCancel(target)) {
    cancel('Example run cancelled.')
    process.exit(0)
}

const buildSpinner = spinner()
buildSpinner.start('Building the local host bundle')
const build = spawn(npmCommand, ['run', 'build:host'], {
    cwd: root,
    env,
    stdio: 'pipe',
})
if (build.status !== 0 || build.error) {
    buildSpinner.stop('Host build failed.')
    if (build.stdout) process.stdout.write(build.stdout)
    if (build.stderr) process.stderr.write(build.stderr)
    process.exit(build.status ?? 1)
}
buildSpinner.stop('Local host bundle is ready.')

if (target === 'blazor-server') {
    outro('Starting Blazor Server with the local C# client.')
    try {
        run(dotnetCommand, ['run', '--project', 'examples/blazor-server', '-p:LclaUseLocalSource=true'], { env })
    } catch (error) {
        cancel(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    }
} else if (target === 'maui') {
    outro('Starting .NET MAUI with the local C# client.')
    try {
        run(dotnetCommand, [
            'build',
            'examples/maui/LightningChartMauiExample.csproj',
            '-t:Run',
            '-f',
            'net10.0-windows10.0.19041.0',
            '-p:LclaUseLocalSource=true',
        ], { env })
    } catch (error) {
        cancel(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    }
} else if (target === 'uno') {
    outro('Starting Uno Platform with the local C# client.')
    try {
        run(dotnetCommand, [
            'run',
            '--project',
            'examples/uno/LightningChartUnoExample.csproj',
            '-p:LclaUseLocalSource=true',
        ], { env })
    } catch (error) {
        cancel(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    }
} else {
    const flutterDirectory = resolve(root, 'examples/flutter')
    const overridePath = resolve(flutterDirectory, 'pubspec_overrides.yaml')
    const localFlutterOverride =
        'dependency_overrides:\n  lightning_chart_flutter:\n    path: ../../packages/clients/flutter/lightning_chart_flutter\n'
    if (existsSync(overridePath)) {
        if (readFileSync(overridePath, 'utf8') !== localFlutterOverride) {
            cancel('examples/flutter/pubspec_overrides.yaml is user-managed. Remove it before using the local runner.')
            process.exit(1)
        }
        rmSync(overridePath)
    }

    writeFileSync(overridePath, localFlutterOverride)

    try {
        outro('Starting Flutter with the local package source.')
        run(flutterCommand, ['pub', 'get'], { env, cwd: flutterDirectory })
        run(flutterCommand, ['run', `--dart-define=LCJS_LICENSE_KEY=${env.LCJS_LICENSE_KEY}`], {
            env,
            cwd: flutterDirectory,
        })
    } catch (error) {
        cancel(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    } finally {
        rmSync(overridePath, { force: true })
    }
}
