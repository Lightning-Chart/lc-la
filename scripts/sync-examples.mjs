#!/usr/bin/env node
// Mirrors examples/<name> to its standalone repository.
//
//   node scripts/sync-examples.mjs [<example>...]            dry run: show what would change
//   node scripts/sync-examples.mjs [<example>...] --push     verify, commit and push
//
// --push first builds every selected example against the published packages
// (see verify-examples.mjs); pass --skip-verify to bypass.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { capture, exec, exportExample, root, selectExamples } from './examples.mjs'
import { verifyExamples } from './verify-examples.mjs'

const args = process.argv.slice(2)
const push = args.includes('--push')
const skipVerify = args.includes('--skip-verify')
const selected = selectExamples(args.filter((arg) => !arg.startsWith('--')))

if (push && !skipVerify) {
    const failures = verifyExamples(selected)
    if (failures.length > 0) {
        console.error(`\nNot pushing: verification failed for ${failures.join(', ')}.`)
        process.exit(1)
    }
}

const sourceCommit = capture('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).trim()
const results = []

for (const example of selected) {
    const checkout = mkdtempSync(join(tmpdir(), `lcla-sync-${example.name}-`))
    try {
        console.log(`\n== ${example.name} -> ${example.repo}`)
        exec('git', ['clone', '--quiet', example.repo, checkout])
        const isEmptyRemote = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: checkout }).status !== 0

        for (const entry of readdirSync(checkout)) {
            if (entry !== '.git') rmSync(join(checkout, entry), { recursive: true, force: true })
        }
        const count = exportExample(example, checkout)
        exec('git', ['add', '--all'], { cwd: checkout })

        const changes = capture('git', ['status', '--short'], { cwd: checkout }).trim().split('\n').filter(Boolean)
        if (changes.length === 0) {
            console.log(`Up to date (${count} files).`)
            results.push([example.name, 'up to date'])
            continue
        }
        console.log(changes.slice(0, 20).join('\n') + (changes.length > 20 ? `\n... ${changes.length - 20} more` : ''))
        if (!push) {
            results.push([example.name, 'would update'])
            continue
        }

        if (isEmptyRemote) exec('git', ['checkout', '--quiet', '-B', 'main'], { cwd: checkout })
        exec('git', ['commit', '--quiet', '-m', `Sync ${example.name} example from lc-la@${sourceCommit}`], { cwd: checkout })
        exec('git', ['push', 'origin', 'HEAD'], { cwd: checkout })
        results.push([example.name, 'pushed'])
    } catch (error) {
        console.error(`FAILED: ${error.message}`)
        results.push([example.name, 'failed'])
    } finally {
        rmSync(checkout, { recursive: true, force: true })
    }
}

console.log('\nSummary:')
for (const [name, status] of results) console.log(`  ${name}: ${status}`)
if (!push) console.log('\nDry run only. Re-run with --push to publish.')
if (results.some(([, status]) => status === 'failed')) process.exit(1)
