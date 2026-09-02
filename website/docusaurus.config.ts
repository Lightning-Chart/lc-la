import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const baseUrl = process.env.NODE_ENV === 'development' ? '/docs/' : '/lc-la/docs/'

const readRootEnv = (key: string): string => {
  const envPath = resolve(__dirname, '..', '.env')
  if (existsSync(envPath)) {
    for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const separator = line.indexOf('=')
      if (separator < 1 || line.slice(0, separator).trim() !== key) continue
      let value = line.slice(separator + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      return value
    }
  }
  return process.env[key] ?? ''
}

const docsLicenseKey = readRootEnv('LCJS_DOCS_LICENSE_KEY')

const config: Config = {
  title: 'LightningChart LA',
  tagline: 'Language-agnostic high-performance charts',
  url: 'https://lightningchart.com',
  baseUrl,
  organizationName: 'lightningchart',
  projectName: 'lightningchart-la',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  customFields: {
    docsLicenseKey,
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    prism: {
      additionalLanguages: ['dart', 'csharp'],
    },
    navbar: {
      title: 'LightningChart LA',
      logo: {
        alt: 'LightningChart LA placeholder logo',
        src: 'img/lcla-placeholder-logo.svg',
      },
      items: [],
    },
    footer: {
      style: 'dark',
      links: [
        {
          items: [
            {
              label: 'lightningchart.com',
              href: 'https://lightningchart.com/',
            },
          ],
        },
      ],
      copyright: `Copyright (c) ${new Date().getFullYear()} LightningChart Ltd.`,
    },
  } satisfies Preset.ThemeConfig,
}

export default config
