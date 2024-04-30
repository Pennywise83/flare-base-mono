import { NetworkEnum } from "../../../../../libs/commons/src";
import { NavigationItem } from "../services/navigation/navigation";

export const navigationDefinition: { [network: string]: NavigationItem[] } = {
    'flare': [
        {
            id: 'ftso',
            title: 'Ftso',
            link: '/flare/ftso/data-providers',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#42d9b5',
            children: [
                {
                    id: 'data-providers-explorer',
                    title: 'Data providers explorer',
                    type: 'basic',
                    link: '/flare/ftso/data-providers-explorer',
                    icon: 'heroicons_outline:cube',
                    color: '#42d9b5'
                },
                {
                    id: 'ftso-feeds',
                    title: 'Data Provider Feeds',
                    type: 'basic',
                    link: '/flare/ftso/data-providers/feeds',
                    icon: 'heroicons_outline:cube',
                    color: '#42d9b5'
                }
            ]
        },
        {
            id: 'delegations',
            title: 'Delegations',
            link: '/flare/delegations/explorer',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#046ba3',
            children: [
                {
                    id: 'delegations-explorer',
                    title: 'Delegations explorer',
                    type: 'basic',
                    link: '/flare/delegations/explorer',
                    icon: 'heroicons_outline:cube',
                    color: '#046ba3'
                },
                {
                    id: 'votepower-history',
                    title: 'Vote power history',
                    type: 'basic',
                    link: '/flare/delegations/votepower-history',
                    icon: 'heroicons_outline:cube',
                    color: '#046ba3'

                },
                {
                    id: 'delegations-search',
                    title: 'Delegations search',
                    type: 'basic',
                    link: '/flare/delegations/search',
                    icon: 'heroicons_outline:cube',
                    color: '#046ba3'

                }
            ]
        },
        {
            id: 'rewards',
            title: 'Rewards',
            link: '/flare/rewards/',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#bf4641',
            children: [
                {
                    id: 'claimed-rewards-search',
                    title: 'Claimed rewards search',
                    type: 'basic',
                    link: '/flare/rewards/search',
                    icon: 'heroicons_outline:cube',
                    color: '#bf4641'

                }
            ]
        },
        {
            id: 'wallet',
            title: 'Wallet',
            link: '/flare/wallet',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#4e427f',
            children: [
                {
                    id: 'wallet',
                    title: 'Dashboard',
                    type: 'basic',
                    link: '/flare/wallet/dashboard',
                    icon: 'heroicons_outline:cube',
                    color: '#4e427f'
                },
                {
                    id: 'rewards-management',
                    title: 'Manage rewards',
                    type: 'basic',
                    link: '/flare/wallet/rewards-management',
                    icon: 'heroicons_outline:cube',
                    color: '#4e427f'

                },
                {
                    id: 'delegations-management',
                    title: 'Manage delegations',
                    type: 'basic',
                    link: '/flare/wallet/delegations-management',
                    icon: 'heroicons_outline:cube',
                    color: '#4e427f'

                }
            ]
        },
    ],
    'songbird': [
        {
            id: 'ftso',
            title: 'Ftso',
            link: '/songbird/ftso/data-providers',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#42d9b5',
            children: [
                {
                    id: 'data-providers-explorer',
                    title: 'Data providers explorer',
                    type: 'basic',
                    link: '/songbird/ftso/data-providers-explorer',
                    icon: 'heroicons_outline:cube',
                    color: '#42d9b5'
                },
                {
                    id: 'ftso-feeds',
                    title: 'Data Provider Feeds',
                    type: 'basic',
                    link: '/songbird/ftso/data-providers/feeds',
                    icon: 'heroicons_outline:cube',
                    color: '#42d9b5'
                }
            ]
        },
        {
            id: 'delegations',
            title: 'Delegations',
            link: '/songbird/delegations/explorer',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#046ba3',
            children: [
                {
                    id: 'delegations-explorer',
                    title: 'Delegations explorer',
                    type: 'basic',
                    link: '/songbird/delegations/explorer',
                    icon: 'heroicons_outline:cube',
                    color: '#046ba3'
                },
                {
                    id: 'votepower-history',
                    title: 'Vote power history',
                    type: 'basic',
                    link: '/songbird/delegations/votepower-history',
                    icon: 'heroicons_outline:cube',
                    color: '#046ba3'

                },
                {
                    id: 'delegations-search',
                    title: 'Delegations search',
                    type: 'basic',
                    link: '/songbird/delegations/search',
                    icon: 'heroicons_outline:cube',
                    color: '#046ba3'

                }
            ]
        },
        {
            id: 'rewards',
            title: 'Rewards',
            link: '/songbird/rewards/',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#bf4641',
            children: [
                {
                    id: 'claimed-rewards-search',
                    title: 'Claimed rewards search',
                    type: 'basic',
                    link: '/songbird/rewards/search',
                    icon: 'heroicons_outline:cube',
                    color: '#bf4641'

                }
            ]
        },
        {
            id: 'wallet',
            title: 'Wallet',
            link: '/songbird/wallet',
            type: 'group',
            icon: 'heroicons_outline:cube-transparent',
            color: '#4e427f',
            children: [
                {
                    id: 'wallet',
                    title: 'Dashboard',
                    type: 'basic',
                    link: '/songbird/wallet/dashboard',
                    icon: 'heroicons_outline:cube',
                    color: '#4e427f'
                },
                {
                    id: 'rewards-management',
                    title: 'Manage rewards',
                    type: 'basic',
                    link: '/songbird/wallet/rewards-management',
                    icon: 'heroicons_outline:cube',
                    color: '#4e427f'

                },
                {
                    id: 'delegations-management',
                    title: 'Manage delegations',
                    type: 'basic',
                    link: '/songbird/wallet/delegations-management',
                    icon: 'heroicons_outline:cube',
                    color: '#4e427f'

                }
            ]
        },
    ]
};