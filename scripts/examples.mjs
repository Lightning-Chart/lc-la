import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Examples contained in this repository.
 * Each directory contains one runnable project.
 */
export const examples = [
    {
        name: 'BlazorServerEcg',
        client: 'blazor-server',
        label: 'Multiple ECG streams',
        directory: 'examples/blazor-server/BlazorServerEcg',
        project: 'BlazorServerEcg.csproj',
        steps: [['dotnet', 'build']],
    },
    {
        name: 'BlazorServerComparison',
        client: 'blazor-server',
        label: 'Charting tool comparison',
        directory: 'examples/blazor-server/BlazorServerComparison',
        project: 'BlazorServerComparison.csproj',
        steps: [['dotnet', 'build']],
    },
    {
        name: 'BlazorWasmVehicleTelemetry',
        client: 'blazor-wasm',
        label: 'Vehicle telemetry dashboard',
        directory: 'examples/blazor-wasm/BlazorWasmVehicleTelemetry',
        project: 'BlazorWasmVehicleTelemetry.csproj',
        steps: [['dotnet', 'build']],
    },
    {
        name: 'MauiVitalSigns',
        client: 'maui',
        label: 'Patient vital signs',
        directory: 'examples/maui/MauiVitalSigns',
        project: 'MauiVitalSigns.csproj',
        framework: 'net10.0-windows10.0.19041.0',
        steps: [['dotnet', 'build', '-f', 'net10.0-windows10.0.19041.0']],
        platform: 'win32',
    },
    {
        name: 'UnoDroneFlight',
        client: 'uno',
        label: 'Drone flight dashboard',
        directory: 'examples/uno/UnoDroneFlight',
        project: 'UnoDroneFlight.csproj',
        steps: [['dotnet', 'build']],
        platform: 'win32',
    },
    {
        name: 'example-patient-dashboard',
        client: 'flutter',
        label: 'Patient dashboard',
        directory: 'examples/flutter/example-patient-dashboard',
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