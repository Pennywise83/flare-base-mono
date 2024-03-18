import { isNotEmpty } from "class-validator";
import { VotePower } from "../votepower";
import { DataProviderInfo } from "./data-provider-info";
import { FtsoRewardStats } from "./ftso-reward-stats";

export class DataProviderExtendedInfo {
    address: string;
    name: string;
    listed: boolean;
    icon: string;
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
    providerReward: number = 0;
    delegatorsReward: number = 0;
    rewardRate: number = 0;
    previousRewardRate: number = 0;

    constructor(
        votePower: VotePower, 
        previousVotePower: VotePower, 
        dataProvidersInfo: DataProviderInfo[], 
        totalVotePower: VotePower, 
        previousTotalVotePower: VotePower, 
        whitelistedAddresses: string[],
        ftsoRewardStat: FtsoRewardStats,
        previousFtsoRewardStat: FtsoRewardStats
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
        if (isNotEmpty(ftsoRewardStat)) {
            this.providerReward = ftsoRewardStat.providerReward;
            this.delegatorsReward = ftsoRewardStat.delegatorsReward;
            this.rewardRate = ftsoRewardStat.rewardRate;
            
        }
        if (isNotEmpty(previousFtsoRewardStat)) {
            this.previousRewardRate = previousFtsoRewardStat.rewardRate;
        }
    }
}