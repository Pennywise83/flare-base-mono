
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import appConfig from '../../app-config-loader';
import { IBlockchainDao } from '../../dao/blockchain/i-blockchain-dao.service';
import { BLOCKCHAIN_DAO_FLR, BlockchainDaoFlrImpl } from '../../dao/blockchain/impl/blockchain-dao-flr-impl.service';
import { BLOCKCHAIN_DAO_SGB, BlockchainDaoSgbImpl } from '../../dao/blockchain/impl/blockchain-dao-sgb-impl.service';
import { IPersistenceDao } from '../../dao/persistence/i-persistence-dao.service';
import { PersistenceMetadataType } from '../../dao/persistence/impl/model/persistence-metadata';
import { PERSISTENCE_DAO_FLR, PersistenceDaoFlrImpl } from '../../dao/persistence/impl/persistence-dao-flr-impl.service';
import { PERSISTENCE_DAO_SGB, PersistenceDaoSgbImpl } from '../../dao/persistence/impl/persistence-dao-sgb-impl.service';
import { EpochsService } from '../epochs/epochs.service';
import { NetworkDaoDispatcherService } from '../network-dao-dispatcher/network-dao-dispatcher.service';
import { NetworkEnum } from '../../controller/model/network-dto';

describe('Persistence metadata test suite', () => {
    let _networkDaoDispatcher: NetworkDaoDispatcherService;
    let _persistenceDao: IPersistenceDao;
    let _blockchainDao: IBlockchainDao;

    beforeEach(async () => {
        process.argv[2] = './config-test.yml';
        const moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    load: [appConfig],
                    isGlobal: true
                })

            ],
            providers: [{
                provide: APP_PIPE,
                useClass: ValidationPipe,
                useValue: {
                    transform: true,
                    whitelist: true

                },
            },
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
            }
            ],
        }).compile();

        _networkDaoDispatcher = moduleRef.get<NetworkDaoDispatcherService>(NetworkDaoDispatcherService);
    });

    describe('Delegations metadata', () => {
        it("Clean data", async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);
            expect(await persistenceDao.truncate()).toBe(true);
        })
        it('Test case 1', async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 0, 20);
            let p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, null, 10, 15);
            expect(p1.length).toEqual(1);
            expect(p1[0].from).toEqual(0);
            expect(p1[0].to).toEqual(20);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 20, 30);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 30, 40);
            let p2 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 5, 35);
            expect(p2.length).toEqual(3);
            expect(p2[0].from).toEqual(0);
            expect(p2[0].to).toEqual(20);
            expect(p2[1].to).toEqual(30);
            expect(p2[2].to).toEqual(40);
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p2);
            let p3 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 5, 35);
            expect(p3.length).toEqual(2);
            expect(p3[0].from).toEqual(0);
            expect(p3[0].to).toEqual(20);
            expect(p3[1].from).toEqual(0);
            expect(p3[1].to).toEqual(40);
        }, 60000);
        it('Test case 2', async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 20, 50);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 50, 55);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 55, 60);
            let p4 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 50, 55);
            expect(p4.length).toEqual(3);
            expect(p4[0].from).toEqual(20);
            expect(p4[0].to).toEqual(50);
            expect(p4[1].from).toEqual(50);
            expect(p4[1].to).toEqual(55);
            expect(p4[2].from).toEqual(55);
            expect(p4[2].to).toEqual(60);
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p4);
            let p5 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 50, 55);
            expect(p5.length).toEqual(1);
            expect(p5[0].from).toEqual(20);
            expect(p5[0].to).toEqual(60);
        }, 60000);

        it('Test case 3', async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);
            let p6 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 10, 55);
            expect(p6.length).toEqual(3);
            expect(p6[0].from).toEqual(0);
            expect(p6[0].to).toEqual(20);
            expect(p6[0].value).toEqual('all');
            expect(p6[1].from).toEqual(0);
            expect(p6[1].to).toEqual(40);
            expect(p6[1].value).toEqual('a');
            expect(p6[2].from).toEqual(20);
            expect(p6[2].to).toEqual(60);
            expect(p6[2].value).toEqual('all');

            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p6);
            let p7 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'A', 10, 55);
            expect(p7.length).toEqual(2);
            expect(p7[0].from).toEqual(0);
            expect(p7[0].to).toEqual(60);
            expect(p7[0].value).toEqual('a');
            expect(p7[1].from).toEqual(0);
            expect(p7[1].to).toEqual(60);
            expect(p7[1].value).toEqual('all');
        }, 60000);

        it('Test case 4', async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);

            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 50, 75);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 80, 85);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 90, 100);



            let p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 75, 86);
            expect(p1.length).toEqual(2);
            expect(p1[0].from).toEqual(50);
            expect(p1[0].to).toEqual(75);
            expect(p1[1].from).toEqual(80);
            expect(p1[1].to).toEqual(85);
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p1);


            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 75, 86);
            expect(p1.length).toEqual(2);

            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 76, 79);
            expect(p1.length).toEqual(0);

            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 50, 90);
            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 76, 79);
            expect(p1.length).toEqual(1);
            expect(p1[0].from).toEqual(50);
            expect(p1[0].to).toEqual(90);
            expect(p1[0].value).toEqual('all');

            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p1);
            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 75, 86);
            expect(p1.length).toEqual(3);
            expect(p1[0].from).toEqual(50);
            expect(p1[0].to).toEqual(75);
            expect(p1[0].value).toEqual('b');
            expect(p1[1].from).toEqual(50);
            expect(p1[1].to).toEqual(90);
            expect(p1[1].value).toEqual('all');
            expect(p1[2].from).toEqual(80);
            expect(p1[2].to).toEqual(85);
            expect(p1[2].value).toEqual('b');
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p1);

            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'b', 75, 86);
            expect(p1.length).toEqual(2);
            expect(p1[0].from).toEqual(50);
            expect(p1[0].to).toEqual(90);
            expect(p1[0].value).toEqual('all');
            expect(p1[1].from).toEqual(50);
            expect(p1[1].to).toEqual(90);
            expect(p1[1].value).toEqual('b');
        }, 60000);
        it('Test case 5', async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 100, 115);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 120, 135);
            let p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 95, 118);
            expect(p1.length).toEqual(1);
            expect(p1[0].from).toEqual(100);
            expect(p1[0].to).toEqual(115);

            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 95, 100);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 115, 118);

            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 95, 118);
            expect(p1.length).toEqual(3);

            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p1);

            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'c', 95, 118);
            expect(p1.length).toEqual(1);
        }, 60000);

        it('Test case 6', async () => {
            const persistenceDao: IPersistenceDao = await _networkDaoDispatcher.getPersistenceDao(NetworkEnum.flare);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 200, 230);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'd', 250, 260);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'd', 260, 270);
            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 240, 280);

            let p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'd', 210, 255);
            expect(p1.length).toEqual(3);
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p1);
            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'd', 210, 255);
            expect(p1.length).toEqual(4);
            expect(p1[1].value).toEqual('d');
            expect(p1[1].from).toEqual(200);
            expect(p1[1].to).toEqual(230);
            expect(p1[3].value).toEqual('d');
            expect(p1[3].from).toEqual(240);
            expect(p1[3].to).toEqual(280);

            await persistenceDao.storePersistenceMetadata(PersistenceMetadataType.Delegation, 'all', 230, 240);
            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'd', 210, 255);
            expect(p1.length).toEqual(5);
            await persistenceDao.optimizePersistenceMetadata(PersistenceMetadataType.Delegation, p1);
            p1 = await persistenceDao.getPersistenceMetadata(PersistenceMetadataType.Delegation, 'd', 210, 255);
            expect(p1.length).toEqual(2);
        }, 60000);
    });
});