import { cancel, intro, isCancel, multiselect, outro } from '@clack/prompts'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputPath = process.env.LCLA_RELEASE_TARGETS_FILE
if (!outputPath) {
    throw new Error('LCLA_RELEASE_TARGETS_FILE is required.')
}

intro('LightningChart LA release')
const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDirectories = [
    resolve(rootDirectory, 'packages'),
    resolve(rootDirectory, 'packages', 'clients'),
]
const options = releaseDirectories.flatMap((directory) =>
    readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(directory, entry.name, 'release.sh'))
        .filter(existsSync)
        .map((releaseScript) => {
            const packageDirectory = relative(rootDirectory, dirname(releaseScript))
            return {
                value: relative(rootDirectory, releaseScript),
                label: packageDirectory,
                hint: 'publish',
            }
        }),
)
options.push({
    value: 'website',
    label: 'website',
    hint: 'build for manual deployment',
})
const targets = await multiselect({
    message: 'Select release targets',
    required: true,
    options,
})

if (isCancel(targets)) {
    cancel('Release cancelled.')
    process.exit(0)
}

writeFileSync(outputPath, `${targets.join(' ')}\n`)
outro('Release targets selected.')
