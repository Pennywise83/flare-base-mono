import { isEmpty, isNotEmpty } from "class-validator";
import { Subscription } from "rxjs";
import { IBlockchainDao } from "../dao/blockchain/i-blockchain-dao.service";
import { IPersistenceDao } from "../dao/persistence/i-persistence-dao.service";
import { PersistenceMetadataScanInfo } from "../dao/persistence/impl/model/persistence-metadata";
import { ServiceStatusEnum } from "./network-dao-dispatcher/model/service-status.enum";
import { ProgressGateway } from "./progress.gateway";
import { ICacheDao } from "../dao/cache/i-cache-dao.service";

export class ServiceUtils {

    static isServiceUnavailable(service: IBlockchainDao | IPersistenceDao | ICacheDao): boolean {
        return isEmpty(service) || (isNotEmpty(service) && service.status !== ServiceStatusEnum.STARTED);
    }

    static getEffectiveAddress(from: string, to: string): string | null {
        return isNotEmpty(from) ? from : (isNotEmpty(to) ? to : null);
    }


    static monitorProgress(requestId: string, missingRewardEpochBlockNumbers: PersistenceMetadataScanInfo[], blockchainDao: IBlockchainDao, progressGateway: ProgressGateway): Subscription {
        const blockMin: number = missingRewardEpochBlockNumbers[0].from;
        const blockMax: number = missingRewardEpochBlockNumbers[missingRewardEpochBlockNumbers.length - 1].to;

        const progressSubscription: Subscription = blockchainDao.blockScanProgressListener$.subscribe(res => {
            if ((res as any).key == `${requestId}`) {
                const lastBlockNumber: number = (res as any).lastBlockNumber;
                const percentage = ((lastBlockNumber - blockMin) / (blockMax - blockMin)) * 100;
                progressGateway.server.emit(requestId, percentage);
            }
        });

        return progressSubscription;
    }
}