
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import appConfig from '../../app-config-loader';
import { BLOCKCHAIN_DAO_FLR, BlockchainDaoFlrImpl } from '../../dao/blockchain/impl/blockchain-dao-flr-impl.service';
import { BLOCKCHAIN_DAO_SGB, BlockchainDaoSgbImpl } from '../../dao/blockchain/impl/blockchain-dao-sgb-impl.service';
import { PERSISTENCE_DAO_FLR, PersistenceDaoFlrImpl } from '../../dao/persistence/impl/persistence-dao-flr-impl.service';
import { PERSISTENCE_DAO_SGB, PersistenceDaoSgbImpl } from '../../dao/persistence/impl/persistence-dao-sgb-impl.service';
import { EpochsService } from '../epochs/epochs.service';
import { NetworkDaoDispatcherService } from '../network-dao-dispatcher/network-dao-dispatcher.service';
import { IPersistenceDao } from '../../dao/persistence/i-persistence-dao.service';
import { IBlockchainDao } from '../../dao/blockchain/i-blockchain-dao.service';
import { PriceEpochSettings, RewardEpochSettings } from '@flare-base/commons';
import { plainToClass } from 'class-transformer';

describe('Epoch service test suite', () => {
    let priceEpochSettings: PriceEpochSettings = new PriceEpochSettings();
    let rewardEpochSettings: RewardEpochSettings = new RewardEpochSettings();
    beforeEach(async () => {
        jest.useFakeTimers('modern' as any);
        priceEpochSettings.firstEpochStartTime = 1657740870000;
        priceEpochSettings.priceEpochDurationMillis = 180000;
        priceEpochSettings.revealEpochDurationMillis = 90000;
        priceEpochSettings = plainToClass(PriceEpochSettings, priceEpochSettings);

        rewardEpochSettings.firstEpochStartTime = 1658430000000;
        rewardEpochSettings.rewardEpochDurationMillis = 302400000;
        rewardEpochSettings = plainToClass(RewardEpochSettings, rewardEpochSettings);
        /* [
            {
                "id": 200000,
                "startTime": 1693740870000, // '2023-09-03 13:34:30'
                "endTime": 1693741050000, // '2023-09-03 13:37:30'
                "revealEndTime": 1693741140000, // '2023-09-03 13:39:00'
            },
            {
                "id": 199999,
                "startTime": 1693740690000, // '2023-09-03 13:31:30'
                "endTime": 1693740870000, // '2023-09-03 13:34:30'
                "revealEndTime": 1693740960000, // '2023-09-03 13:36:00'
            },
            {
                "id": 199998,
                "startTime": 1693740690000, // '2023-09-03 13:28:30'
                "endTime": 1693740870000, // '2023-09-03 13:31:30'
                "revealEndTime": 1693740960000, // '2023-09-03 13:33:00'
            }
        ] */
    });

    describe('Reward epoch', () => {
        /*
        {
            "id": 154,
            "startTime": 1704697200000,
            "endTime": 1704999600000,
        },
        {
            "id": 153,
            "startTime": 1704697202000,
            "startBlockNumber": 17869193,
            "endTime": 1704999600000,
            "votePowerTime": 1704662546000,
            "votePowerBlockNumber": 17849852
        }
        {
            "id": 152,
            "startTime": 1704394801000,
            "startBlockNumber": 17699829,
            "endTime": 1704697200000,
            "votePowerTime": 1704347169000,
            "votePowerBlockNumber": 17673362
        }


        */
        it("getCurrentEpochId - Just after the beginning of the epoch", async () => {
            let now: string = '2024-01-08 08:00:01';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(153);
        });
        it("getCurrentEpochId - Near the end of the epoch", async () => {
            let now: string = '2024-01-11 19:59:59';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(153);
        });
        it("getCurrentEpochId - At the exact begin of the epoch", async () => {
            let now: string = '2024-01-08 08:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(153);
        });
        it("getCurrentEpochId - At the exact end of the epoch", async () => {
            let now: string = '2024-01-11 20:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getCurrentEpochId - At the exact begin of the next epoch", async () => {
            let now: string = '2024-01-11 20:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getCurrentEpochId - Just after the begin of the next epoch", async () => {
            let now: string = '2024-01-11 20:00:01';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getCurrentEpochId - In the middle of the current epoch", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getCurrentEpochId();
            expect(currentEpochId).toEqual(153);
        });

        it("getNextEpochId - Just after the beginning of the current epoch", async () => {
            let now: string = '2024-01-08 08:00:01';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getNextEpochId - Near the end of the current epoch", async () => {
            let now: string = '2024-01-11 19:59:59';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getNextEpochId - At the exact begin of the current epoch", async () => {
            let now: string = '2024-01-08 08:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getNextEpochId - At the exact end of the current epoch", async () => {
            let now: string = '2024-01-11 20:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(155);
        });
        it("getNextEpochId - At the exact begin of the next epoch", async () => {
            let now: string = '2024-01-11 20:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(155);
        });
        it("getNextEpochId - Just after the begin of the next epoch", async () => {
            let now: string = '2024-01-11 20:00:01';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(155);
        });
        it("getNextEpochId - In the middle of the current epoch", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let currentEpochId: number = rewardEpochSettings.getNextEpochId();
            expect(currentEpochId).toEqual(154);
        });
        it("getEpochIdForTime - getEndTimeForEpochId 153 ", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let endTime: number = rewardEpochSettings.getEpochIdForTime(1704999000000);
            expect(endTime).toEqual(153);
        });

        it("getEndTimeForEpochId 154 ", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let endTime: number = rewardEpochSettings.getEndTimeForEpochId(154);
            expect(endTime).toEqual(1705302000000);
        });

        it("getStartTimeForEpochId 154 ", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let startTime: number = rewardEpochSettings.getStartTimeForEpochId(154);
            expect(startTime).toEqual(1704999600000);
        });

        it("getStartTimeForEpochId 153 ", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let endTime: number = rewardEpochSettings.getStartTimeForEpochId(153);
            expect(endTime).toEqual(1704697200000);
        });
        it("getEndTimeForEpochId 153 ", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let endTime: number = rewardEpochSettings.getEndTimeForEpochId(153);
            expect(endTime).toEqual(1704999600000);
        });
        it("From 152 to 152", async () => {
            let now: string = '2024-01-11 00:00:00';

            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(152), rewardEpochSettings.getEndTimeForEpochId(152));
            expect(epochIds.length).toEqual(1);
            expect(epochIds[0]).toEqual(152);
        });
        it("From 152 to 153", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(152), rewardEpochSettings.getEndTimeForEpochId(153));
            expect(epochIds.length).toEqual(2);
            expect(epochIds[0]).toEqual(152);
            expect(epochIds[1]).toEqual(153);
        });
        it("From 152 to few seconds before 153", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(152), rewardEpochSettings.getEndTimeForEpochId(153) - 1000);
            expect(epochIds.length).toEqual(2);
            expect(epochIds[0]).toEqual(152);
            expect(epochIds[1]).toEqual(153);
        });
        it("From 152 to few seconds after 153", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(152), rewardEpochSettings.getEndTimeForEpochId(153) + 1000);
            expect(epochIds.length).toEqual(3);
            expect(epochIds[0]).toEqual(152);
            expect(epochIds[1]).toEqual(153);
            expect(epochIds[2]).toEqual(154);
        });

        it("From 153 to 154 (current)", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(153), rewardEpochSettings.getEndTimeForEpochId(154));
            expect(epochIds.length).toEqual(2);
            expect(epochIds[0]).toEqual(153);
            expect(epochIds[1]).toEqual(154);
        });
        it("From 153 to few seconds before 154 (current)", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(153), rewardEpochSettings.getEndTimeForEpochId(154) - 1000);
            expect(epochIds.length).toEqual(2);
            expect(epochIds[0]).toEqual(153);
            expect(epochIds[1]).toEqual(154);
        });
        it("From 153 to few seconds after 154 (current)", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(153), rewardEpochSettings.getEndTimeForEpochId(154) + 1000);
            expect(epochIds.length).toEqual(3);
            expect(epochIds[0]).toEqual(153);
            expect(epochIds[1]).toEqual(154);
            expect(epochIds[2]).toEqual(155);
        });
        it("From 153 to after 156, two epochs after next one", async () => {
            let now: string = '2024-01-11 00:00:00';
            jest.setSystemTime(new Date(now).getTime());
            let epochIds: number[] = rewardEpochSettings.getEpochIdsFromTimeRange(rewardEpochSettings.getStartTimeForEpochId(153), rewardEpochSettings.getEndTimeForEpochId(156) + 1000);
            expect(epochIds.length).toEqual(3);
            expect(epochIds[0]).toEqual(153);
            expect(epochIds[1]).toEqual(154);
            expect(epochIds[2]).toEqual(155);
        });


    });
     describe('Price epoch', () => {
        it("getLastFinalizedPriceEpoch - Now is between startTime and endTime", async () => {
            let now: string = '2023-09-03 13:34:52';
            jest.setSystemTime(new Date(now).getTime());
            let fizedEpochId: number = priceEpochSettings.getLastFinalizedEpochId();
            expect(fizedEpochId).toEqual(199_998);
        });
        it("getLastFinalizedPriceEpoch - Now is equal to endTime and before revealTime", async () => {
            let now: string = '2023-09-03 13:37:30';
            jest.setSystemTime(new Date(now).getTime());
            let fizedEpochId: number = priceEpochSettings.getLastFinalizedEpochId();
            expect(fizedEpochId).toEqual(199_999);
        });
        it("getLastFinalizedPriceEpoch - Now is between endTime and revealTime", async () => {
            let now: string = '2023-09-03 13:38:45';
            jest.setSystemTime(new Date(now).getTime());
            let fizedEpochId: number = priceEpochSettings.getLastFinalizedEpochId();
            expect(fizedEpochId).toEqual(199_999);
        });
        it("getLastFinalizedPriceEpoch - Now is after revealTime", async () => {
            let now: string = '2023-09-03 13:40:29';
            jest.setSystemTime(new Date(now).getTime());
            let fizedEpochId: number = priceEpochSettings.getLastFinalizedEpochId();
            expect(fizedEpochId).toEqual(199_999);

            let now2: string = '2023-09-03 13:40:31';
            jest.setSystemTime(new Date(now2).getTime());
            let fizedEpochId2: number = priceEpochSettings.getLastFinalizedEpochId();
            expect(fizedEpochId2).toEqual(200_000);
        });
        it("getEpochIdsFromTimeRange - 1", async () => {
            let now: string = '2023-09-03 13:40:00';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:35:59';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(1);
            expect(expectedEpochIds[0]).toEqual(199998);

        });
        it("getEpochIdsFromTimeRange - 2", async () => {
            let now: string = '2023-09-03 13:35:00';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:36:30';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(2);
            expect(expectedEpochIds[0]).toEqual(199998);
            expect(expectedEpochIds[1]).toEqual(199999);

        });
        it("getEpochIdsFromTimeRange - 3", async () => {
            let now: string = '2023-09-03 13:35:00';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:36:00';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(2);
            expect(expectedEpochIds[0]).toEqual(199998);
            expect(expectedEpochIds[1]).toEqual(199999);
        });
        it("getEpochIdsFromTimeRange - 4", async () => {
            let now: string = '2023-09-03 13:35:00';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:35:50';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(1);
            expect(expectedEpochIds[0]).toEqual(199998);
        });
        it("getEpochIdsFromTimeRange - 5", async () => {
            let now: string = '2023-09-03 13:35:00';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:39:50';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(2);
            expect(expectedEpochIds[0]).toEqual(199998);
            expect(expectedEpochIds[1]).toEqual(199999);
        });
        it("getEpochIdsFromTimeRange - 6", async () => {
            let now: string = '2023-09-03 13:40:00';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:39:50';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(3);
            expect(expectedEpochIds[0]).toEqual(199998);
            expect(expectedEpochIds[1]).toEqual(199999);
            expect(expectedEpochIds[2]).toEqual(200000);
        });
        it("getEpochIdsFromTimeRange - 7", async () => {
            let now: string = '2023-09-03 13:35:01';
            let from: string = '2023-09-03 13:33:00';
            let to: string = '2023-09-03 13:35:00';
            jest.setSystemTime(new Date(now).getTime());
            let expectedEpochIds: number[] = priceEpochSettings.getEpochIdsFromTimeRange(new Date(from).getTime(), new Date(to).getTime());
            expect(expectedEpochIds.length).toEqual(1);
            expect(expectedEpochIds[0]).toEqual(199998);
        });
    }); 
    afterAll(() => {
        jest.useRealTimers();
    })
});


