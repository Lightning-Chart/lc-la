import type { SidebarsConfig } from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docs: [
    'overview/index',
    {
      type: 'category',
      label: 'Clients',
      link: {
        type: 'doc',
        id: 'clients/index',
      },
      items: ['clients/csharp', 'clients/maui', 'clients/uno', 'clients/flutter'],
    },
    {
      type: 'category',
      label: 'Features',
      link: {
        type: 'doc',
        id: 'features/index',
      },
      items: [
        'features/context',
        'features/data-management',
        'features/charts',
        'features/series',
        'features/axes',
        'features/user-interactions',
      ],
    },
    'contributing',
  ],
}

export default sidebars
