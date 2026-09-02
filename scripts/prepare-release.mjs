#!/usr/bin/env node

import { get } from 'node:https'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = process.argv[2]
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const versionsPath = resolve(root, 'versions.json')
const versions = JSON.parse(readFileSync(versionsPath, 'utf8'))
const releaseLine = versions.releaseLine
const releaseLineMatch = /^(\d+)\.(\d+)$/.exec(releaseLine)
if (!releaseLineMatch) {
    throw new Error(`versions.json releaseLine must use major.minor format; found "${releaseLine}".`)
}
const sharedMajor = Number(releaseLineMatch[1])
const sharedMinor = Number(releaseLineMatch[2])

const fetchJson = (url) => new Promise((resolveResponse, reject) => {
    const request = get(url, { headers: { 'user-agent': 'lcla-release' } }, (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => { body += chunk })
        response.on('end', () => {
            if (response.statusCode !== 200) {
                reject(new Error(`${url} returned HTTP ${response.statusCode}.`))
                return
            }
            try {
                resolveResponse(JSON.parse(body))
            } catch (error) {
                reject(error)
            }
        })
    })
    request.on('error', reject)
    request.setTimeout(15_000, () => request.destroy(new Error(`Timed out requesting ${url}.`)))
})

const parseSharedPatch = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
    if (!match || Number(match[1]) !== sharedMajor || Number(match[2]) !== sharedMinor) return undefined
    return Number(match[3])
}

const nextPatch = (versions) => {
    const patches = versions.map(parseSharedPatch).filter((patch) => patch !== undefined)
    const patch = patches.length === 0 ? 0 : Math.max(...patches) + 1
    return `${sharedMajor}.${sharedMinor}.${patch}`
}

const replaceFile = (path, expression, value) => {
    const content = readFileSync(path, 'utf8')
    if (!expression.test(content)) throw new Error(`Could not find version in ${path}.`)
    const updated = content.replace(expression, value)
    if (updated !== content) writeFileSync(path, updated)
}

const prepareHost = async () => {
    const metadata = await fetchJson('https://registry.npmjs.org/@lcla%2fhost')
    const version = nextPatch(Object.keys(metadata.versions ?? {}))
    const path = resolve(root, 'packages/host/package.json')
    const manifest = JSON.parse(readFileSync(path, 'utf8'))
    manifest.version = version
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
    return version
}

const prepareCsharp = async () => {
    const metadata = await fetchJson('https://api.nuget.org/v3-flatcontainer/lcla/index.json')
    const version = nextPatch(metadata.versions ?? [])
    replaceFile(
        resolve(root, 'packages/clients/csharp/LightningChart.LA/LightningChart.LA.csproj'),
        /<Version>.*?<\/Version>/,
        `<Version>${version}</Version>`,
    )
    for (const example of [
        'examples/blazor-server/BlazorServerExample.csproj',
        'examples/maui/LightningChartMauiExample.csproj',
        'examples/uno/LightningChartUnoExample.csproj',
    ]) {
        replaceFile(
            resolve(root, example),
            /(<PackageReference Include="LCLA" Version=")[^"]*(" \/>)/,
            `$1${version}$2`,
        )
    }
    return version
}

const prepareFlutter = async () => {
    let metadata
    try {
        metadata = await fetchJson('https://pub.dev/api/packages/lightning_chart_flutter')
    } catch (error) {
        if (!/HTTP 404/.test(error.message)) throw error
        metadata = { versions: [] }
    }
    const version = nextPatch((metadata.versions ?? []).map((entry) => entry.version))
    replaceFile(
        resolve(root, 'packages/clients/flutter/lightning_chart_flutter/pubspec.yaml'),
        /^version:\s*.*$/m,
        `version: ${version}`,
    )
    return version
}

const prepare = { host: prepareHost, csharp: prepareCsharp, flutter: prepareFlutter }[target]
if (!prepare) {
    throw new Error('Usage: node scripts/prepare-release.mjs <host|csharp|flutter>')
}

const version = await prepare()
console.log(`Prepared ${target} release ${version}.`)
