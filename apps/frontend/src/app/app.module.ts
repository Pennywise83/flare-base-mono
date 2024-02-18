import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconsModule } from '@ng-icons/core';
import { heroBanknotes, heroChevronRight, heroFaceFrown, heroGlobeAlt, heroHashtag, heroMagnifyingGlass, heroQuestionMarkCircle, heroWallet, heroArrowPath, heroCheckBadge, heroArrowRight, heroPlusCircle, heroLink } from '@ng-icons/heroicons/outline';
import { featherLoader, featherGithub, featherClock, featherDownload, featherRefreshCw, featherHash, featherAward } from '@ng-icons/feather-icons';
import { matSwapHorizOutline } from '@ng-icons/material-icons/outline';

import { NgEventBus } from 'ng-event-bus';
import { SocketIoConfig, SocketIoModule } from 'ngx-socket-io';
import { BreadcrumbModule } from 'xng-breadcrumb';
import { JazziconModule } from 'ngx-jazzicon';


const progressWsConfig: SocketIoConfig = {
  url: '/progress',
  options: {
    transports: ['websocket'],
  },
};


@NgModule({
  declarations: [

  ],
  imports: [
    RouterLink,
    CommonModule,
    SocketIoModule.forRoot(progressWsConfig),
    NgIconsModule.withIcons({ heroMagnifyingGlass, heroWallet, heroBanknotes, heroHashtag, heroGlobeAlt, heroFaceFrown, heroQuestionMarkCircle, heroChevronRight, featherDownload, heroArrowPath, featherRefreshCw, featherHash, featherClock, featherAward, heroCheckBadge, featherGithub, matSwapHorizOutline, heroArrowRight, featherLoader, heroPlusCircle, heroLink }),
    JazziconModule.forRoot({}),
    BreadcrumbModule
  ],
  providers: [NgEventBus],
  exports: [NgIconsModule, CommonModule, BreadcrumbModule],
})
export class AppModule { }
