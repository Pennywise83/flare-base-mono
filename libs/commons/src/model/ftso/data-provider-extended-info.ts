import { isNotEmpty } from "class-validator";
import { VotePower } from "../votepower";
import { DataProviderInfo } from "./data-provider-info";
import { DataProviderRewardStats } from "./data-provider-reward-stats";
import { DataProviderSubmissionStats } from "./data-provider-submission-stats";
import { FtsoFee } from "./ftso-fee";

export class DataProviderExtendedInfo {
    address: string;
    name: string;
    listed: boolean;
    icon: string;
    nextVotePower: number;
    votePower: number;
    previousVotePower: number;
    votePowerChange: number = 0;
    votePowerPercentage: number = 0;
    previousVotePowerPercentage: number = 0;
    numberOfDelegators: number;
    previousNumberOfDelegators: number;
    numberOfDelegatorsChange: number = 0;
    numberOfDelegations: number;
    previousNumberOfDelegations: number;
    numberOfDelegationsChange: number = 0;
    whitelisted: boolean = false;
    providerRewards: number = 0;
    delegatorsRewards: number = 0;
    rewardRate: number = 0;
    previousRewardRate: number = 0;
    availability6h: number = 0;
    availabilityRewardEpoch: number = 0;
    successRate: number = 0;
    successRateIQR: number = 0;
    successRatePct: number = 0;
    successRate6h: number = 0;
    successRateIQR6h: number = 0;
    successRatePct6h: number = 0;
    fee: number = 0;


    constructor(
        votePower: VotePower,
        previousVotePower: VotePower,
        dataProvidersInfo: DataProviderInfo[],
        totalVotePower: VotePower,
        previousTotalVotePower: VotePower,
        whitelistedAddresses: string[],
        ftsoRewardStats: DataProviderRewardStats,
        previousFtsoRewardStats: DataProviderRewardStats,
        ftsoSubmissionStats: DataProviderSubmissionStats,
        ftsoFee: FtsoFee,
        ftsoSubmissionStats6h?: DataProviderSubmissionStats

    ) {
        this.address = votePower.address;
        let dataProviderInfo: DataProviderInfo = dataProvidersInfo.find(dpInfo => dpInfo.address == votePower.address)
        if (isNotEmpty(dataProviderInfo)) {
            this.name = dataProviderInfo.name;
            this.icon = dataProviderInfo.icon;
            this.listed = dataProviderInfo.listed;
        } else {
            this.name = 'Unknown provider';
            this.listed = false;
        }
        if (whitelistedAddresses.includes(votePower.address)) {
            this.whitelisted = true;
        } else {
            this.whitelisted = false;
        }
        this.votePower = votePower.amount;
        this.numberOfDelegations = votePower.delegations;
        this.numberOfDelegators = votePower.delegators;
        if (isNotEmpty(totalVotePower)) {
            this.votePowerPercentage = (votePower.amount * 100) / totalVotePower.amount
        }
        if (isNotEmpty(previousVotePower)) {
            this.previousVotePower = previousVotePower.amount;
            this.previousNumberOfDelegations = previousVotePower.delegations;
            this.previousNumberOfDelegators = previousVotePower.delegators;
            this.votePowerChange = parseFloat((((this.votePower * 100) / this.previousVotePower) - 100).toFixed(5));
            this.numberOfDelegatorsChange = parseFloat((((this.numberOfDelegators * 100) / this.previousNumberOfDelegators) - 100).toFixed(5));
            this.numberOfDelegationsChange = parseFloat((((this.numberOfDelegations * 100) / this.previousNumberOfDelegations) - 100).toFixed(5));
            if (isNotEmpty(previousTotalVotePower)) {
                this.previousVotePowerPercentage = (previousVotePower.amount * 100) / previousTotalVotePower.amount
            }
        }
        if (isNotEmpty(ftsoRewardStats)) {
            this.providerRewards = ftsoRewardStats.providerReward;
            this.delegatorsRewards = ftsoRewardStats.delegatorsReward;
            this.rewardRate = ftsoRewardStats.rewardRate;

        }
        if (isNotEmpty(previousFtsoRewardStats)) {
            this.previousRewardRate = previousFtsoRewardStats.rewardRate;
        }
        if (isNotEmpty(ftsoFee)) {
            this.fee = ftsoFee.value;
        }
        if (isNotEmpty(ftsoSubmissionStats)) {
            this.successRate = ftsoSubmissionStats.successRate;
            this.successRateIQR = ftsoSubmissionStats.successRateIQR;
            this.successRatePct = ftsoSubmissionStats.successRatePct;
            this.availabilityRewardEpoch = ftsoSubmissionStats.availability;
        }
        if (isNotEmpty(ftsoSubmissionStats6h)) {
            this.availability6h = ftsoSubmissionStats6h.availability;
            this.successRate6h = ftsoSubmissionStats6h.successRate;
            this.successRateIQR6h = ftsoSubmissionStats6h.successRateIQR;
            this.successRatePct6h = ftsoSubmissionStats6h.successRatePct;
        } else {
            delete this.availability6h;
            delete this.successRate6h;
            delete this.successRateIQR6h;
            delete this.successRatePct6h;
        }
    }
}