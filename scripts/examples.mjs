import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const org = 'git@github.com:Lightning-Chart'

/**
 * Examples contained in this repository.
 * Entries with a repo are also published to a standalone repository.
 * * `steps` are run in a clean copy to prove the example works against the released package.
 */
export const examples = [
    {
        name: 'BlazorServerComparison',
        client: 'blazor-server',
        label: 'Charting tool comparison',
        project: 'BlazorServerComparison.csproj',
        steps: [['dotnet', 'build']],
    },
    {
        name: 'BlazorServerEcg',
        client: 'blazor-server',
        label: 'Multiple ECG streams',
        repo: `${org}/lc-la-example-blazor-server.git`,
        project: 'BlazorServerEcg.csproj',
        steps: [['dotnet', 'build']],
    },
    {
        name: 'BlazorWasmVehicleTelemetry',
        client: 'blazor-wasm',
        label: 'Vehicle telemetry dashboard',
        repo: `${org}/lc-la-example-blazor-wasm.git`,
        project: 'BlazorWasmVehicleTelemetry.csproj',
        steps: [['dotnet', 'build']],
    },
    {
        name: 'MauiHeatmaps',
        client: 'maui',
        label: 'Heatmaps',
        project: 'MauiHeatmaps.csproj',
        framework: 'net10.0-windows10.0.19041.0',
        steps: [['dotnet', 'build', '-f', 'net10.0-windows10.0.19041.0']],
        platform: 'win32',
    },
    {
        name: 'MauiMultipleAxes',
        client: 'maui',
        label: 'Multiple axes',
        project: 'MauiMultipleAxes.csproj',
        framework: 'net10.0-windows10.0.19041.0',
        steps: [['dotnet', 'build', '-f', 'net10.0-windows10.0.19041.0']],
        platform: 'win32',
    },
    {
        name: 'MauiVitalSigns',
        client: 'maui',
        label: 'Patient vital signs',
        repo: `${org}/lc-la-example-maui.git`,
        project: 'MauiVitalSigns.csproj',
        framework: 'net10.0-windows10.0.19041.0',
        steps: [['dotnet', 'build', '-f', 'net10.0-windows10.0.19041.0']],
        platform: 'win32',
    },
    {
        name: 'UnoDroneFlight',
        client: 'uno',
        label: 'Drone flight dashboard',
        repo: `${org}/lc-la-example-uno.git`,
        project: 'UnoDroneFlight.csproj',
        steps: [['dotnet', 'build']],
        platform: 'win32',
    },
    {
        name: 'example-patient-dashboard',
        client: 'flutter',
        label: 'Patient dashboard',
        repo: `${org}/lc-la-example-flutter.git`,
        steps: [
            ['flutter', 'pub', 'get'],
            ['flutter', 'build', 'web'],
        ],
    },
]

export const selectExamples = (names) => {
    if (names.length === 0) return examples
    return names.map((name) => {
        const example = examples.find((candidate) => candidate.name === name)
        if (!example) {
            throw new Error(`Unknown example "${name}". Available: ${examples.map((e) => e.name).join(', ')}.`)
        }
        return example
    })
}

const resolveCommand = (command, args) => {
    const batch = { flutter: 'flutter.bat', dart: 'dart.bat', npm: 'npm.cmd' }[command]
    const isWindowsBatch = process.platform === 'win32' && batch !== undefined
    return isWindowsBatch
        ? ['cmd.exe', ['/d', '/s', '/c', batch, ...args]]
        : [command, args]
}

export const exec = (command, args, options = {}) => {
    const [file, finalArgs] = resolveCommand(command, args)
    const result = spawnSync(file, finalArgs, { stdio: 'inherit', ...options })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}.`)
}

export const capture = (command, args, options = {}) => {
    const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr}`)
    return result.stdout
}

/** Copy the files a standalone clone of the example would contain: tracked and untracked, minus ignored. */
export const exportExample = (example, destination) => {
    const directory = `examples/${example.client}/${example.name}`
    const files = capture('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', directory], {
        cwd: root,
    })
        .split('\0')
        .filter(Boolean)
        // Never copy environment files.
        .filter(file => !file.split('/').some(part => part.startsWith('.env')))

    for (const file of files) {
        const target = resolve(destination, relative(directory, file))
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(resolve(root, file), target)
    }
    return files.length
}