import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const org = 'git@github.com:Lightning-Chart'

/**
 * Every example is published to its own standalone repository.
 * `steps` are run in a clean copy to prove the example works against the released package.
 */
export const examples = [
    { name: 'blazor-server', project: 'BlazorServerExample.csproj', repo: `${org}/lc-la-example-blazor-server.git`, steps: [['dotnet', 'build']] },
    { name: 'blazor-wasm', project: 'BlazorWasmExample.csproj', repo: `${org}/lc-la-example-blazor-wasm.git`, steps: [['dotnet', 'build']] },
    {
        name: 'maui',
        project: 'LightningChartMauiExample.csproj',
        repo: `${org}/lc-la-example-maui.git`,
        steps: [['dotnet', 'build', '-f', 'net10.0-windows10.0.19041.0']],
        platform: 'win32',
    },
    { name: 'uno', project: 'LightningChartUnoExample.csproj', repo: `${org}/lc-la-example-uno.git`, steps: [['dotnet', 'build']], platform: 'win32' },
    {
        name: 'flutter',
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
    const batch = { flutter: 'flutter.bat', npm: 'npm.cmd' }[command]
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
    const directory = `examples/${example.name}`
    const files = capture('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', directory], {
        cwd: root,
    })
        .split('\0')
        .filter(Boolean)
    for (const file of files) {
        const target = resolve(destination, relative(directory, file))
        mkdirSync(dirname(target), { recursive: true })
        copyFileSync(resolve(root, file), target)
    }
    return files.length
}
