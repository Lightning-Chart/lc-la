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
        'features/charts',
        'features/data-management',
        'features/series',
        'features/axes',
        'features/user-interactions',
      ],
    },
    'contributing',
  ],
}

export default sidebars
