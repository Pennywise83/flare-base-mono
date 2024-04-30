import { Route } from '@angular/router';
import { ClaimedRewardsSearchComponent } from './modules/claimed-rewards-search/claimed-rewards-search.component';
import { DataProviderDetailsComponent } from './modules/data-providers-explorer/data-provider-details/data-provider-details.component';
import { DataProviderFeedsComponent } from './modules/data-providers-explorer/data-provider-feeds/data-provider-feeds.component';
import { DataProvidersExplorerComponent } from './modules/data-providers-explorer/data-providers-explorer.component';
import { DelegationsExplorerDetailsComponent } from './modules/delegations-explorer/delegations-explorer-details/delegations-explorer-details.component';
import { DelegationsExplorerComponent } from './modules/delegations-explorer/delegations-explorer.component';
import { DelegationsSearchComponent } from './modules/delegations-search/delegations-search.component';
import { Error404Component } from './modules/error-404/error-404.component';
import { HomeComponent } from './modules/home-component/home.component';
import { MainComponent } from './modules/main/main.component';
import { VotePowerHistoryComponent } from './modules/vote-power-history/votepower-history.component';
import { WalletDashboardComponent } from './modules/wallet/wallet-dashboard/wallet-dashboard.component';
import { WalletDelegationsManagementComponent } from './modules/wallet/wallet-delegations-management/wallet-delegations-management.component';
import { WalletRewardsManagementComponent } from './modules/wallet/wallet-rewards-management/wallet-rewards-management.component';
import { DataProvidersSubmissionStatsMatrixComponent } from './modules/data-providers-explorer/data-providers-submission-stats-matrix/data-providers-submission-stats-matrix.component';
import { DelegationVotePowerHistoryComponent } from './modules/delegations-explorer/delegations-vote-power-history/delegations-vote-power-history.component';


export const appRoutes: Route[] = [
    { path: '', pathMatch: 'full', redirectTo: '/flare' },
    {
        path: ':network', component: MainComponent, children: [
            { path: '', component: HomeComponent },
            {
                path: 'wallet', data: { breadcrumb: { label: 'Wallet' } }, children: [
                    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
                    { path: 'dashboard', component: WalletDashboardComponent },
                    { path: 'rewards-management', data: { breadcrumb: { label: 'Rewards management' } }, component: WalletRewardsManagementComponent },
                    { path: 'delegations-management', data: { breadcrumb: { label: 'Delegations management' } }, component: WalletDelegationsManagementComponent },
                ]
            },
            {
                path: 'rewards', data: { breadcrumb: { label: 'Rewards' } }, children: [
                    { path: '', redirectTo: 'search', pathMatch: 'full' },
                    { path: 'search', data: { breadcrumb: { label: 'Search' } }, component: ClaimedRewardsSearchComponent }
                ]
            },
            {
                path: 'delegations', children: [
                    { path: '', redirectTo: 'explorer/current', pathMatch: 'full' },
                    {
                        path: 'explorer', children: [
                            { path: '', redirectTo: 'current', pathMatch: 'full' },
                            {
                                path: ':rewardEpoch', data: {
                                    breadcrumb: (resolvedId: string) => {
                                        return resolvedId == 'current' ? 'Current Reward epoch' : `Reward epoch ${resolvedId}`;
                                    },
                                }, children: [
                                    { path: '', redirectTo: 'overview', pathMatch: 'full' },
                                    { path: 'overview', data: { breadcrumb: { label: 'Overview' } }, component: DelegationsExplorerComponent },
                                    { path: ':address', component: DelegationsExplorerDetailsComponent },
                                ]
                            },
                        ]
                    },
                    {
                        path: 'search', data: { breadcrumb: { label: 'Search' } }, component: DelegationsSearchComponent
                    },
                    {
                        path: 'votepower-history', data: { breadcrumb: { label: 'Vote power history' } }, component: DelegationVotePowerHistoryComponent
                    }
                ]
            },
            {
                path: 'ftso', children: [
                    { path: '', redirectTo: 'data-providers-explorer/current', pathMatch: 'full', data: { breadcrumb: { label: 'Ftso' } } },
                    {
                        path: 'data-providers-explorer', children: [
                            { path: '', data: { breadcrumb: { label: 'Data Providers' } }, redirectTo: 'current', pathMatch: 'full' },
                            {
                                path: ':rewardEpoch', data: {
                                    breadcrumb: (resolvedId: string) => {
                                        return resolvedId == 'current' ? 'Current Reward epoch' : `Reward epoch ${resolvedId}`;
                                    },
                                }, children: [
                                    { path: '', redirectTo: 'overview', pathMatch: 'full' },
                                    { path: 'overview', data: { breadcrumb: { label: 'Overview' } }, component: DataProvidersExplorerComponent },
                                ]
                            },
                        ]
                    },
                    {
                        path: 'data-providers/:section', data: {
                            breadcrumb: (resolvedId: string) => {
                                return resolvedId.indexOf('feeds') >= 0 ? 'Data Providers Feeds' : resolvedId.split('/')[resolvedId.split('/').length - 1];
                            },
                        }, component: DataProviderDetailsComponent
                    }
                ]
            }
        ]
    },
    { path: '**', pathMatch: 'full', component: Error404Component },
];