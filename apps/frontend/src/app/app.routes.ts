import { Route } from '@angular/router';
import { DataProviderDelegationsComponent } from './modules/delegations-explorer/data-provider-delegations/data-provider-delegations.component';
import { DelegationsExplorerComponent } from './modules/delegations-explorer/delegations-explorer.component';
import { DelegationsSearchComponent } from './modules/delegations-search/delegations-search.component';
import { MainComponent } from './modules/main/main.component';
import { VotePowerHistoryComponent } from './modules/vote-power-history/votepower-history.component';
import { WalletBalanceComponent } from './modules/wallet/wallet-balance/wallet-balance.component';
import { WalletDashboardComponent } from './modules/wallet/wallet-dashboard/wallet-dashboard.component';
import { WalletDelegationsComponent } from './modules/wallet/wallet-delegations/wallet-delegations.component';
import { WalletDelegationsManagementComponent } from './modules/wallet/wallet-delegations-management/wallet-delegations-management.component';
import { ClaimedRewardsSearchComponent } from './modules/claimed-rewards-search/claimed-rewards-search.component';
import { WalletRewardsManagementComponent } from './modules/wallet/wallet-rewards-management/wallet-rewards-management.component';
import { HomeComponent } from './modules/home-component/home.component';
import { Error404Component } from './modules/error-404/error-404.component';


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
                                    { path: ':address', component: DataProviderDelegationsComponent },
                                ]
                            },
                        ]
                    },
                    {
                        path: 'search', data: { breadcrumb: { label: 'Search' } }, component: DelegationsSearchComponent
                    },
                    {
                        path: 'votepower-history', data: { breadcrumb: { label: 'Vote power history' } }, component: VotePowerHistoryComponent
                    }
                ]
            }
        ]
    },
    { path: '**', pathMatch: 'full', component: Error404Component },
];