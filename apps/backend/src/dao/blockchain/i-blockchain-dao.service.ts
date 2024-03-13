import { Balance, Delegation, FlrContract, HashSubmitted, PriceEpoch, PriceEpochSettings, PriceFinalized, PriceRevealed, Reward, RewardEpoch, RewardEpochSettings, RewardsDistributed, SgbContract, VoterWhitelist } from "@flare-base/commons";
import { Logger } from "@nestjs/common";
import { ethers } from "ethers";
import { Subject } from "rxjs";
import { BlockchainDaoConfig } from "../../model/app-config/blockchain-dao-config";

import { ServiceStatusEnum } from "../../service/network-dao-dispatcher/model/service-status.enum";
import { FtsoManagerWrapper } from "./model/ftso-manager-wrapper";

export interface IBlockchainDao {

    logger: Logger;
    status: ServiceStatusEnum;
    config: BlockchainDaoConfig;

    provider: ethers.Provider;
    contractsList: { [name: string]: string };
    priceSubmitter: FlrContract.PriceSubmitter | SgbContract.PriceSubmitter;
    addressUpdater: FlrContract.AddressUpdater | SgbContract.AddressUpdater;
    ftsoRewardManager: FlrContract.FtsoRewardManager | SgbContract.FtsoRewardManager;
    ftsoManager: FlrContract.FtsoManager | SgbContract.FtsoManager;
    ftsoManagerWrapper: FtsoManagerWrapper;
    voterWhitelister: FlrContract.VoterWhitelister | SgbContract.VoterWhitelister;
    wnat: FlrContract.WNat | SgbContract.WNat;
    VPContract: FlrContract.VPContract | SgbContract.VPContract;
    _rewardEpochSettings: RewardEpochSettings;
    _priceEpochSettings: PriceEpochSettings;

    initialize(): Promise<void>;

    // Constants
    getRewardEpochSettings(): Promise<RewardEpochSettings>;
    getPriceEpochSettings(): Promise<PriceEpochSettings>;

    blockScanProgressListener$: Subject<{ key: string, lastBlockNumber: number }>;


    // Reward epochs
    getRewardEpoch(id: number): Promise<RewardEpoch>;
    getCurrentRewardEpoch(): Promise<RewardEpoch>;
    startRewardEpochListener(): Promise<void>;
    rewardEpochListener$: Subject<PriceEpoch>;
    // Price epochs
    getPriceEpochs(priceEpochStart: number, priceEpochEnd: number): Promise<PriceEpoch[]>;
    priceEpochListener$: Subject<PriceEpoch>;

    // Rewards
    getClaimedRewards(address: string, startBlock: number, endBlock: number, requestId?: string): Promise<Reward[]>;
    startClaimedRewardsListener(): Promise<void>;
    claimedRewardsListener$: Subject<Reward>;

    // Balances
    getBalances(address: string, startBlock: number, endBlock: number): Promise<Balance[]>;
    startWrappedBalanceListener(): Promise<void>;
    wrappedBalanceListener$: Subject<Balance>;

    // Delegations
    getDelegations(address: string, startBlock: number, endBlock: number): Promise<Delegation[]>;
    startDelegationsListener(): Promise<void>;
    delegationsListener$: Subject<Delegation>;

    // Ftso

    startPricesRevealedListener(): Promise<void>;
    pricesRevealedListener$: Subject<PriceRevealed>;
    startPriceFinalizedListener(): Promise<void>;
    pricesFinalizedListener$: Subject<PriceFinalized>;
    startHashSubmittedListener(): Promise<void>;
    hashSubmittedListener$: Subject<HashSubmitted>;
    startRewardDistributedListener(): Promise<void>;
    rewardDistributedListener$: Subject<RewardsDistributed>;
    getActiveFtsoContracts(): number;

    getVoterWhitelist(startBlock: number, endBlock: number): Promise<VoterWhitelist[]>;
    startVoterWhitelistListener(): Promise<void>;
    voterWhitelistListener$: Subject<VoterWhitelist>;

    getFtsoWhitelistedPriceProviders(): Promise<string[]>;
    getFinalizedPrices(symbol: string, startBlock: number, endBlock: number): Promise<PriceFinalized[]>;




}