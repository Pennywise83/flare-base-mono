import { isNotEmpty } from "class-validator";
import { BlockInfo } from "../blockchain";
import { RewardEpoch, RewardEpochDTO, RewardEpochSettings } from "../epochs";

export class Delegation extends BlockInfo {
    from: string;
    to: string;
    amount: number;
    constructor() {
        super();
    }
}

export class DelegationSnapshot extends Delegation {
    rewardEpoch: number;
    constructor(delegation: Delegation, rewardEpochId: number) {
        super();
        this.from = delegation.from;
        this.to = delegation.to;
        this.timestamp = delegation.timestamp;
        this.amount = delegation.amount;
        this.rewardEpoch = rewardEpochId;
        delete this.blockNumber;
    }
}

export class DelegationDTO extends Delegation {
    rewardEpochId: number;
    rewardEpochStartTime: number;
    rewardEpochEndTime: number;
    votePowerTime: number;

    fromDelegation(data: Delegation, rewardEpochs: RewardEpoch[], rewardEpochSettings: RewardEpochSettings): DelegationDTO {
        let delegationDTO: DelegationDTO = new DelegationDTO();
        let rewardEpoch: RewardEpoch = null;
        if (isNotEmpty(rewardEpochs) && rewardEpochs.length > 0 && isNotEmpty(rewardEpochSettings)) {
            rewardEpochs.map((re, idx) => {
                if (idx > 0) {
                    if (data.timestamp <= re.votePowerTimestamp && data.timestamp >= rewardEpochs[idx - 1].votePowerTimestamp) {
                        rewardEpoch = re;
                    }
                } else {
                    if (data.timestamp <= re.votePowerTimestamp) {
                        rewardEpoch = re;
                    }
                }
            })
        }
        if (rewardEpoch != null) {
            let rewardEpochDto: RewardEpochDTO = new RewardEpochDTO(rewardEpoch, rewardEpochSettings);
            delegationDTO.rewardEpochId = rewardEpoch.id;
            delegationDTO.rewardEpochStartTime = rewardEpochDto.startTime;
            delegationDTO.rewardEpochEndTime = rewardEpochDto.endTime;
            delegationDTO.votePowerTime = rewardEpochDto.votePowerTime;
        } else {
            delegationDTO.rewardEpochId = null;
            delegationDTO.rewardEpochStartTime = null;
            delegationDTO.rewardEpochEndTime = null;
            delegationDTO.votePowerTime = null;
        }
        delegationDTO.blockNumber = data.blockNumber;
        delegationDTO.from = data.from.toLowerCase();
        delegationDTO.to = data.to.toLowerCase();
        delegationDTO.amount = data.amount;
        delegationDTO.timestamp = data.timestamp;
        return delegationDTO;
    }

    constructor() {
        super();
    }
    fromResponse(data: DelegationResponse): DelegationDTO[] {
        let results: DelegationDTO[] = [];
        data.rewardEpochId.forEach((element, idx) => {
            let obj: DelegationDTO = new DelegationDTO();
            obj.rewardEpochId = data.rewardEpochId[idx]!;
            obj.rewardEpochStartTime = data.rewardEpochStartTime[idx]!;
            obj.rewardEpochEndTime = data.rewardEpochEndTime[idx]!;
            obj.votePowerTime = data.votePowerTime[idx]!;
            obj.from = data.from[idx]!;
            obj.to = data.to[idx]!;
            obj.amount = data.amount[idx]!;
            results.push(obj);
        })
        return results;
    }
}

export class DelegationResponse {
    timestamp: (number | null)[];
    rewardEpochId: (number | null)[];
    rewardEpochStartTime: (number | null)[];
    rewardEpochEndTime: (number | null)[];
    votePowerTime: (number | null)[];
    from: (string | null)[];
    to: (string | null)[];
    amount: (number | null)[];


    constructor(delegateList: DelegationDTO[]) {
        this.timestamp = delegateList.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
        this.rewardEpochId = delegateList.map(item => isNotEmpty(item.rewardEpochId) ? item.rewardEpochId : null);
        this.rewardEpochStartTime = delegateList.map(item => isNotEmpty(item.rewardEpochStartTime) ? item.rewardEpochStartTime : null);
        this.rewardEpochEndTime = delegateList.map(item => isNotEmpty(item.rewardEpochEndTime) ? item.rewardEpochEndTime : null);
        this.votePowerTime = delegateList.map(item => isNotEmpty(item.votePowerTime) ? item.votePowerTime : null);
        this.from = delegateList.map(item => isNotEmpty(item.from) ? item.from : null);
        this.to = delegateList.map(item => isNotEmpty(item.to) ? item.to : null);
        this.amount = delegateList.map(item => isNotEmpty(item.amount) ? item.amount : null);
    }
}
export enum DelegationsSortEnum {
    timestamp = 'timestamp',
    blockNumber = 'blockNumber',
    amount = 'amount',
    from = 'from',
    to = 'to'
}
