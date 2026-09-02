#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [target, version] = process.argv.slice(2)
const validTargets = new Set(['host', 'csharp', 'flutter'])
if (!validTargets.has(target) || !/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error('Usage: node scripts/record-release.mjs <host|csharp|flutter> <major.minor.patch>')
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const path = resolve(root, 'versions.json')
const versions = JSON.parse(readFileSync(path, 'utf8'))
const [major, minor] = version.split('.')
if (versions.releaseLine !== `${major}.${minor}`) {
    throw new Error(`Published version ${version} is outside release line ${versions.releaseLine}.`)
}
versions.packages[target] = version
writeFileSync(path, `${JSON.stringify(versions, null, 2)}\n`)
console.log(`Recorded published ${target} version ${version}.`)
