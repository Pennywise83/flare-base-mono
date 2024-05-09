import { NetworkEnum } from '@flare-base/commons';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { Redis } from 'ioredis';
import appConfig from './app-config-loader';
import { DelegationsController } from './controller/delegations/delegations.controller';
import { EpochsController } from './controller/epochs/epochs.controller';
import { FtsoController } from './controller/ftso/ftso.controller';
import { CustomBadRequestFilter } from './controller/model/custom-bad-request-filter';
import { RewardsController } from './controller/rewards/rewards.controller';
import { VotePowerController } from './controller/votepower/votepower.controller';
import { IBlockchainDao } from './dao/blockchain/i-blockchain-dao.service';
import { BLOCKCHAIN_DAO_FLR, BLOCKCHAIN_DAO_FLR_QUEUE, BlockchainDaoFlrImpl } from './dao/blockchain/impl/blockchain-dao-flr-impl.service';
import { BLOCKCHAIN_DAO_SGB, BLOCKCHAIN_DAO_SGB_QUEUE, BlockchainDaoSgbImpl } from './dao/blockchain/impl/blockchain-dao-sgb-impl.service';
import { ICacheDao } from './dao/cache/i-cache-dao.service';
import { CACHE_DAO_FLR, CacheDaoFlrImpl } from './dao/cache/impl/cache-dao-flr-impl.service';
import { CACHE_DAO_SGB, CacheDaoSgbImpl } from './dao/cache/impl/cache-dao-sgb-impl.service';
import { IPersistenceDao } from './dao/persistence/i-persistence-dao.service';
import { PERSISTENCE_DAO_FLR, PERSISTENCE_DAO_FLR_QUEUE, PersistenceDaoFlrImpl } from './dao/persistence/impl/persistence-dao-flr-impl.service';
import { PERSISTENCE_DAO_SGB, PERSISTENCE_DAO_SGB_QUEUE, PersistenceDaoSgbImpl } from './dao/persistence/impl/persistence-dao-sgb-impl.service';
import { NetworkConfig } from './model/app-config/network-config';
import { AuditLogInterceptor } from './service/audit-logger/audit-logger.interceptor';
import { BalancesService } from './service/balances/balances.service';
import { DelegationsService } from './service/delegations/delegations.service';
import { EpochsService } from './service/epochs/epochs.service';
import { FtsoService } from './service/ftso/ftso.service';
import { NetworkDaoDispatcherService } from './service/network-dao-dispatcher/network-dao-dispatcher.service';
import { ProgressGateway } from './service/progress.gateway';
import { RewardsService } from './service/rewards/rewards.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [appConfig],
            isGlobal: true
        }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                createClient: (type) => {
                    const opts = {
                        enableReadyCheck: false,
                        maxRetriesPerRequest: null,
                        enableOfflineQueue: true,
                        enableAutoPipelining: false
                    }
                    return new Redis.Cluster(configService.get('serverSettings.redisMembers').map(c => { return { host: c.split(':')[0], port: c.split(':')[1] } }), opts)
                }

            }),
            inject: [ConfigService],
        }),
        BullModule.registerQueue({
            name: PERSISTENCE_DAO_FLR_QUEUE,
            prefix: '{q2}'

        }),
        BullModule.registerQueue({
            name: PERSISTENCE_DAO_SGB_QUEUE,
            prefix: '{q2}'

        }),
        BullModule.registerQueue({
            name: BLOCKCHAIN_DAO_FLR_QUEUE,
            prefix: '{q2}'

        }),
        BullModule.registerQueue({
            name: BLOCKCHAIN_DAO_SGB_QUEUE,
            prefix: '{q2}'

        }),
        HttpModule.register({
            timeout: 60000,
            maxRedirects: 5,
        }),

        ConfigModule.forRoot(),
        ServeStaticModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => [{
                rootPath: configService.get<string>('serverSettings.frontendStaticPath') ? configService.get<string>('serverSettings.frontendStaticPath') : '/tmp/flare-base-frontend/',
            }],
            inject: [ConfigService],
        }),


    ],
    controllers: [
        EpochsController,
        RewardsController,
        DelegationsController,
        VotePowerController,
        FtsoController
    ],
    providers: [
        {
            provide: APP_FILTER,
            useClass: CustomBadRequestFilter,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: AuditLogInterceptor,
        },
        {
            provide: APP_PIPE,
            useClass: ValidationPipe,
            useValue: {
                transform: true,
                whitelist: true

            },
        },
        ProgressGateway,
        NetworkDaoDispatcherService,
        {
            provide: BLOCKCHAIN_DAO_FLR,
            useClass: BlockchainDaoFlrImpl
        },
        {
            provide: BLOCKCHAIN_DAO_SGB,
            useClass: BlockchainDaoSgbImpl
        },
        {
            provide: PERSISTENCE_DAO_FLR,
            useClass: PersistenceDaoFlrImpl
        }, {
            provide: PERSISTENCE_DAO_SGB,
            useClass: PersistenceDaoSgbImpl
        },
        {
            provide: CACHE_DAO_FLR,
            useClass: CacheDaoFlrImpl
        }, {
            provide: CACHE_DAO_SGB,
            useClass: CacheDaoSgbImpl
        },

        EpochsService,

        DelegationsService,
        BalancesService,
        RewardsService,
        FtsoService,

    ],
    exports: []
})
export class MainModule {
    constructor(
        private readonly _configService: ConfigService,
        private readonly _networkDaoDispatcher: NetworkDaoDispatcherService,
        private readonly _epochsService: EpochsService,
        private readonly _balanceService: BalancesService,
        private readonly _ftsoService: FtsoService,
        private readonly _delegationsService: DelegationsService,
        private readonly _rewardsService: RewardsService) { }
    async onModuleInit() {
        const availableNetworks: NetworkEnum[] = await this._networkDaoDispatcher.getAvailableNetworks();
        const networkConfigurations: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
        for (const network of availableNetworks) {
            const networkConfig = networkConfigurations.find(nConfig => nConfig.name === network);
            const blockchainDao: IBlockchainDao = await this._networkDaoDispatcher.getBlockchainDao(network);
            const persistenceDao: IPersistenceDao = await this._networkDaoDispatcher.getPersistenceDao(network);
            const cacheDao: ICacheDao = await this._networkDaoDispatcher.getCacheDao(network);
        }
        await this._epochsService.initialize();
        await this._balanceService.initialize();
        await this._delegationsService.initialize();
        await this._rewardsService.initialize();
        await this._ftsoService.initialize();
    }
}
