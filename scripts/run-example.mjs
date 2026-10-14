#!/usr/bin/env node

import { examples } from './examples.mjs'
import { spawn as spawnAsync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
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

const runBlazor = (project, env) =>
    new Promise((resolvePromise, reject) => {
        const windows = process.platform === 'win32'
        if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false)
        const child = spawnAsync(
            dotnetCommand, 
            ['run', '--project', project, '-p:LclaUseLocalSource=true'], 
            { cwd: root, env, stdio: 'inherit', shell: false, windowsHide: true }
        )
        let interrupted = false
        const stop = () => {
            if (interrupted) return
            interrupted = true
            if (child.pid === undefined) return
            if (windows) {
                const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'],{ stdio: 'ignore', windowsHide: true, }, )
                if (result.error) {
                    console.error(result.error.message)
                    child.kill()
                }
            } else {
                child.kill('SIGINT')
            }
        }
        const cleanup = () => {
            process.off('SIGINT', stop)
            process.off('SIGTERM', stop)
        }
        process.on('SIGINT', stop)
        process.on('SIGTERM', stop)
        child.once('error', (error) => {
            cleanup()
            reject(error)
        })
        child.once('close', (code, signal) => {
            cleanup()
            if (interrupted || code === 0 || signal === 'SIGINT') {
                resolvePromise()
            } else {
                reject(new Error(`Blazor exited with ${signal ?? `status ${code}`}.`,))
            }
        })
    })

const readEnv = (path) => {
    if (!existsSync(path)) throw new Error('Missing .env. Copy .env.example to .env and add LCJS_LICENSE_KEY.')
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
    message: 'Choose a client',
    options: [
        { value: 'blazor-server', label: 'Blazor Server', hint: 'C# client' },
        { value: 'blazor-wasm', label: 'Blazor WebAssembly', hint: 'C# client' },
        { value: 'maui', label: '.NET MAUI', hint: 'C# client' },
        { value: 'uno', label: 'Uno Platform', hint: 'C# client' },
        { value: 'flutter', label: 'Flutter', hint: 'Flutter client' },
    ],
})

if (isCancel(target)) {
    cancel('Example run cancelled.')
    process.exit(0)
}

const availableExamples = examples.filter(example => example.client === target)

if (availableExamples.length === 0) {
    cancel(`No examples are registered for ${target}.`)
    process.exit(1)
}

const exampleName = await select({
    message: 'Choose an example',
    options: availableExamples.map(example => ({ value: example.name, label: example.label }))
})

if (isCancel(exampleName)) process.exit(0)

const selectedExample = availableExamples.find(example => example.name === exampleName)

if (!selectedExample) {
    cancel('Selected example was not found.')
    process.exit(1)
}

if (selectedExample.platform && selectedExample.platform !== process.platform) {
    cancel(`This example requires ${selectedExample.platform}.`)
    process.exit(1)
}

const exampleDirectory = resolve(root, selectedExample.directory)

const buildSpinner = spinner()
buildSpinner.start('Building the local host bundle')
const build = spawn(npmCommand, ['run', 'build:host'], { cwd: root, env, stdio: 'pipe' })
if (build.status !== 0 || build.error) {
    buildSpinner.stop('Host build failed.')
    if (build.stdout) process.stdout.write(build.stdout)
    if (build.stderr) process.stderr.write(build.stderr)
    process.exit(build.status ?? 1)
}
buildSpinner.stop('Local host bundle is ready.')

outro(`Starting ${selectedExample.label}.`)

try {
    if (target === 'blazor-server' || target === 'blazor-wasm') {
        await runBlazor(resolve(exampleDirectory, selectedExample.project), env)
    } else if (target === 'maui' || target === 'uno') {
        const args = ['run', '--project', resolve(exampleDirectory, selectedExample.project), '-p:LclaUseLocalSource=true']
        if (selectedExample.framework) args.push('--framework', selectedExample.framework)
        run(dotnetCommand, args, { env })
    } else if (target === 'flutter') {
        const overridePath = resolve(exampleDirectory, 'pubspec_overrides.yaml')
        const packagePath = relative(exampleDirectory, resolve(root, 'packages/clients/flutter/lightning_chart_flutter'),).replaceAll('\\', '/')
        const localFlutterOverride = 'dependency_overrides:\n' + '  lightning_chart_flutter:\n' + `    path: ${packagePath}\n`
        const overrideExists = existsSync(overridePath)
        if (overrideExists && readFileSync(overridePath, 'utf8') !== localFlutterOverride) {
            throw new Error(`${overridePath} contains a different configuration. ` + 'The runner will not overwrite it.')
        }
        if (!overrideExists) writeFileSync(overridePath, localFlutterOverride)
        try {
            run(flutterCommand, ['pub', 'get'], { env, cwd: exampleDirectory })
            run(flutterCommand, ['run', `--dart-define=LCJS_LICENSE_KEY=${env.LCJS_LICENSE_KEY}`], { env, cwd: exampleDirectory })
        } finally {
            if (!overrideExists) rmSync(overridePath, { force: true })
        }
    } else {
        throw new Error(`Unsupported client: ${target}`)
    }
} catch (error) {
    cancel(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
}