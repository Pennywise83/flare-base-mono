import { Balance, Commons, Delegation, FlrContract, FlrContractCommon, FlrContractVP, FlrFtsoRewardManager, FlrVoterWhitelister, FlrWNat, FtsoFee, HashSubmitted, PriceEpoch, PriceEpochSettings, PriceFinalized, PriceRevealed, Reward, RewardEpoch, RewardEpochSettings, SgbContract, VoterWhitelist } from "@flare-base/commons";
import { Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { BlockchainDaoConfig } from "apps/backend/src/model/app-config/blockchain-dao-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { Job, Queue } from "bull";
import { isEmpty, isNotEmpty } from "class-validator";
import { ContractEventPayload, Provider, ethers } from "ethers";
import { RewardDistributed } from "libs/commons/src/model/ftso/reward-distributed";
import { Subject } from "rxjs";
import { IBlockchainDao } from "../i-blockchain-dao.service";
import { DynamicFtso, FtsoManagerWrapper } from "../model/ftso-manager-wrapper";
export type CallFunction = (...args: any[]) => Promise<any>;

export abstract class BlockchainDaoImpl implements IBlockchainDao {
    abstract logger: Logger;
    status: ServiceStatusEnum;
    config: BlockchainDaoConfig;
    _blockchainDaoQueue: Queue;
    provider: Provider;
    contractsList: { [name: string]: string } = {};
    priceSubmitter: FlrContract.PriceSubmitter | SgbContract.PriceSubmitter;
    addressUpdater: FlrContract.AddressUpdater | SgbContract.AddressUpdater;
    ftsoRewardManager: FlrContract.FtsoRewardManager | SgbContract.FtsoRewardManager;
    ftsoManager: FlrContract.FtsoManager | SgbContract.FtsoManager;
    ftsoManagerWrapper: FtsoManagerWrapper;
    wnat: FlrContract.WNat | SgbContract.WNat;
    VPContract: FlrContract.VPContract | SgbContract.VPContract;
    voterWhitelister: FlrContract.VoterWhitelister | SgbContract.VoterWhitelister;
    _rewardEpochSettings: RewardEpochSettings;
    _priceEpochSettings: PriceEpochSettings;
    priceEpochListener$: Subject<PriceEpoch> = new Subject<PriceEpoch>();
    rewardEpochListener$: Subject<RewardEpoch> = new Subject<RewardEpoch>();
    claimedRewardsListener$: Subject<Reward> = new Subject<Reward>();
    wrappedBalanceListener$: Subject<Balance> = new Subject<Balance>();;
    delegationsListener$: Subject<Delegation> = new Subject<Delegation>();
    pricesRevealedListener$: Subject<PriceRevealed> = new Subject<PriceRevealed>();
    pricesFinalizedListener$: Subject<PriceFinalized> = new Subject<PriceFinalized>();
    hashSubmittedListener$: Subject<HashSubmitted> = new Subject<HashSubmitted>();
    rewardDistributedListener$: Subject<RewardDistributed> = new Subject<RewardDistributed>();
    voterWhitelistListener$: Subject<VoterWhitelist> = new Subject<VoterWhitelist>();
    ftsoFeeListener$: Subject<FtsoFee> = new Subject<FtsoFee>();

    blockScanProgressListener$: Subject<{ key: string, lastBlockNumber: number }> = new Subject<{ key: string, lastBlockNumber: number }>();

    private _blockNumberTimestampCache: { [blockNumber: number]: number } = {};
    private _activeFtsoContracts: number = 0;
    constructor() { }

    abstract initialize(): Promise<void>;

    public async getCurrentRewardEpoch(): Promise<RewardEpoch> {
        return new Promise<RewardEpoch>(async (resolve, reject) => {
            try {

                let rewardEpoch: RewardEpoch = await this.getRewardEpoch((await this.getRewardEpochSettings()).getCurrentEpochId());
                resolve(rewardEpoch);
            } catch (err) {
                reject(err);
            }
        })
    }
    public async getRewardEpoch(id: number): Promise<RewardEpoch> {
        return new Promise<RewardEpoch>(async (resolve, reject) => {
            try {
                let rewardEpoch: RewardEpoch = new RewardEpoch();
                rewardEpoch.id = id;
                let rewardEpochData = await this.ftsoManager.getRewardEpochData(id);
                rewardEpoch.votePowerBlockNumber = Number(rewardEpochData[0]);
                rewardEpoch.blockNumber = Number(rewardEpochData[1]);
                rewardEpoch.timestamp = Number(rewardEpochData[2]) * 1000;
                rewardEpoch.votePowerTimestamp = await this._getTimestampFromBlockNumber(Number(rewardEpochData[0]));
                resolve(rewardEpoch);
            } catch (err) {
                reject(err);
            }
        });
    }

    getFtsoWhitelistedPriceProviders(): Promise<string[]> {
        return new Promise<any>(async (resolve, reject) => {
            let providers = await this.voterWhitelister.getFtsoWhitelistedPriceProviders(0);
            resolve(providers);
        })

        return;
    }
    public async getPriceEpochs(blockNumberStart: number, blockNumberEnd: number): Promise<PriceEpoch[]> {
        try {
            if (blockNumberEnd == null) {
                blockNumberEnd = await this.provider.getBlockNumber();
            }
            const filteredFtsoContracts: { [symbol: string]: DynamicFtso[] } = this.ftsoManagerWrapper.getContractsByBlockNumberRange(blockNumberStart, blockNumberEnd);
            const targetContract = Object.values(filteredFtsoContracts)
                .flatMap(currencies => currencies)
                .reduce((minCurrency, currency) => (
                    currency.activeFromBlock < minCurrency.activeFromBlock ? currency : minCurrency
                ));
            const dynamicFtsoContracts = filteredFtsoContracts[targetContract.symbol];
            const events: PriceEpoch[] = [];

            for (const contract of dynamicFtsoContracts) {
                const { activeFromBlock, activeToBlock } = contract;
                let startBlock = activeFromBlock;
                let endBlock = activeToBlock || blockNumberEnd;

                if (startBlock <= blockNumberEnd && endBlock >= blockNumberStart) {
                    startBlock = Math.max(startBlock, blockNumberStart);
                    endBlock = Math.min(endBlock, blockNumberEnd);
                    const job = await this._blockchainDaoQueue.add('scanPriceEpochsProcessor', { contract, startBlock, endBlock });
                    const evts: PriceEpoch[] = await job.finished() as PriceEpoch[];
                    events.push(...evts);
                }
            }
            events.sort((a, b) => a.blockNumber - b.blockNumber);
            return events;
        } catch (err) {
            throw err;
        }
    }




    @Process({ name: 'scanPriceEpochsProcessor', concurrency: 1 })
    private async _scanPriceEpochsProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanFinalizedPrices(job.data['contract'], job.data['startBlock'], job.data['endBlock'])
                .then(res => {
                    let results: PriceEpoch[] = [];
                    if (res.length > 0) {
                        results = res.map(evt => {
                            const priceEpoch: PriceEpoch = new PriceEpoch();
                            priceEpoch.id = Number(evt.args[0]);
                            priceEpoch.timestamp = (evt as any).hasElasticBand
                                ? Number(evt.args[8]) * 1000
                                : Number(evt.args[6]) * 1000;
                            priceEpoch.blockNumber = evt.blockNumber;
                            return priceEpoch;
                        });
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    public async getDelegations(address: string, startBlock: number, endBlock: number): Promise<Delegation[]> {
        return new Promise<Delegation[]>(async (resolve, reject) => {
            try {
                const job = await this._blockchainDaoQueue.add('scanDelegationsProcessor', { startBlock, endBlock, address });
                let results: Delegation[] = await job.finished() as Delegation[];
                if (results.length > 0) {
                    this.logger.log(`_scanDelegations - getting timestamps...`)
                    this._blockNumberTimestampCache = {};
                    const delegateTimestamps: Array<number> = await this._makeBatchedCalls(5000, 10, this._getTimestampFromBlockNumber.bind(this), results.map((evt) => [evt.blockNumber]));
                    delegateTimestamps.map((delegationTimestamp, idx) => {
                        results[idx].timestamp = delegationTimestamp;
                    });
                }
                results.sort((a, b) => a.blockNumber - b.blockNumber);
                resolve(results);
            } catch (err) {
                this.logger.error(`Error while fetching Delegate events': ${err.message}`);
                reject(`Unable to get delegation events for address from the blockchain.`);
            }
        });
    }

    @Process({ name: 'scanDelegationsProcessor', concurrency: 1 })
    private async _scanDelegationsProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanDelegations(job.data['startBlock'], job.data['endBlock'], job.data['address'])
                .then(res => {
                    let results: Delegation[] = [];
                    if (res.length > 0) {
                        for (let idx in res) {
                            let evt: FlrContractVP.DelegateEvent.Log = res[idx];
                            let delegate: Delegation = new Delegation();
                            delegate.from = evt.args.from;
                            delegate.to = evt.args.to;
                            delegate.amount = Number(ethers.formatEther(evt.args.newVotePower));
                            delegate.blockNumber = evt.blockNumber;
                            results.push(delegate);
                        };
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    private async _scanDelegations(startBlock: number, endBlock: number, address?: string): Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrContractVP.DelegateEvent.InputTuple, FlrContractVP.DelegateEvent.OutputTuple, FlrContractVP.DelegateEvent.OutputObject>>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrContractVP.DelegateEvent.InputTuple, FlrContractVP.DelegateEvent.OutputTuple, FlrContractVP.DelegateEvent.OutputObject>>[]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 100;
                let vpContract: FlrContract.VPContract = this.VPContract as FlrContract.VPContract;
                let results: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrContractVP.DelegateEvent.InputTuple, FlrContractVP.DelegateEvent.OutputTuple, FlrContractVP.DelegateEvent.OutputObject>>[] = [];
                const processBlocks = async (start: number, end: number, vpContract: FlrContract.VPContract, address?: string) => {
                    this.logger.verbose(`_scanDelegations - Contract: ${await vpContract.getAddress()} - Address: ${isNotEmpty(address) ? address : '*'} - Processing blocks from ${start} to ${end}  - Size: ${maxScanSize}`);
                    const startTime: number = new Date().getTime();
                    if (isNotEmpty(address)) {
                        const filterFrom = vpContract.filters.Delegate(address, null);
                        const filterTo = vpContract.filters.Delegate(null, address);
                        const eventsFrom: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrContractVP.DelegateEvent.InputTuple, FlrContractVP.DelegateEvent.OutputTuple, FlrContractVP.DelegateEvent.OutputObject>>[] = await vpContract.queryFilter(filterFrom, start, end);
                        const eventsTo: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrContractVP.DelegateEvent.InputTuple, FlrContractVP.DelegateEvent.OutputTuple, FlrContractVP.DelegateEvent.OutputObject>>[] = await vpContract.queryFilter(filterTo, start, end);
                        results = results.concat(eventsFrom);
                        results = results.concat(eventsTo);
                    } else {
                        const filterAll = vpContract.filters.Delegate();
                        const eventsAll: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrContractVP.DelegateEvent.InputTuple, FlrContractVP.DelegateEvent.OutputTuple, FlrContractVP.DelegateEvent.OutputObject>>[] = await vpContract.queryFilter(filterAll, start, end);
                        results = results.concat(eventsAll);
                    }
                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 500);
                    if (end < endBlock) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, endBlock), vpContract, address);
                    }
                };
                await processBlocks(startBlock, Math.min(startBlock + maxScanSize, endBlock), vpContract, address);
                resolve(results);
            } catch (e) {
                reject(e);
            }
        });
    }

    getActiveFtsoContracts(): number {
        return this._activeFtsoContracts;
    }
    async startPriceFinalizedListener(): Promise<void> {
        const lastBlockNumber: number = await this.provider.getBlockNumber();
        let filteredFtsoContracts: { [symbol: string]: DynamicFtso[] } = this.ftsoManagerWrapper.getContractsByBlockNumberRange(lastBlockNumber - 1000, lastBlockNumber);
        let activeSymbols = [];
        Object.keys(filteredFtsoContracts).map(symbol => {
            filteredFtsoContracts[symbol].filter(contract => contract.active).map(contract => activeSymbols.push(contract.symbol));
        });
        this._activeFtsoContracts = activeSymbols.length;
        Object.keys(filteredFtsoContracts).map(async (symbol, symbolIdx) => {
            const contract: FlrContract.Ftso = FlrContract.Ftso__factory.connect(filteredFtsoContracts[symbol][0].address, this.provider);
            const ftsoAddress: string = await contract.getAddress();
            contract.on(contract.filters.PriceFinalized, async (
                epochId: bigint,
                price: bigint,
                rewardedFtso: boolean,
                lowIQRRewardPrice: bigint,
                highIQRRewardPrice: bigint,
                lowElasticBandRewardPrice: bigint,
                highElasticBandRewardPrice: bigint,
                finalizationType: bigint,
                timestamp: bigint,
                event: any
            ) => {
                if (symbolIdx == 0) {
                    // Catch the first priceFinalized event to emit the relative PriceEpoch
                    let priceEpoch: PriceEpoch = new PriceEpoch();
                    priceEpoch.id = Number(epochId);
                    priceEpoch.timestamp = Number(timestamp) * 1000;
                    priceEpoch.blockNumber = event.log.blockNumber;
                    this.priceEpochListener$.next(priceEpoch)
                }
                let priceFinalized: PriceFinalized = new PriceFinalized();
                priceFinalized.epochId = Number(epochId);
                priceFinalized.timestamp = Number(timestamp) * 1000;
                priceFinalized.symbol = this.ftsoManagerWrapper.getSymbolByContractAddress(ftsoAddress);
                priceFinalized.value = (Number(price) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(ftsoAddress));
                priceFinalized.lowIQRRewardPrice = (Number(lowIQRRewardPrice) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(ftsoAddress));
                priceFinalized.highIQRRewardPrice = (Number(highIQRRewardPrice) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(ftsoAddress));
                priceFinalized.lowPctRewardPrice = (Number(lowElasticBandRewardPrice) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(ftsoAddress));
                priceFinalized.highPctRewardPrice = (Number(highElasticBandRewardPrice) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(ftsoAddress));
                priceFinalized.rewardedSymbol = Boolean(rewardedFtso);

                priceFinalized.blockNumber = event.log.blockNumber;
                this.pricesFinalizedListener$.next(priceFinalized);
            })
            return Promise.resolve();
        });

    }
    startRewardEpochListener(): Promise<void> {
        (this.ftsoManager as FlrContract.FtsoManager).on(this.ftsoManager.filters.RewardEpochFinalized, async (
            votepowerBlock: bigint,
            startBlock: bigint,
            event: ContractEventPayload,
        ) => {
            let rewardEpoch: RewardEpoch = await this.getRewardEpoch((await this.getRewardEpochSettings()).getCurrentEpochId());
            this.rewardEpochListener$.next(rewardEpoch);

        })
        return Promise.resolve();
    }
    startDelegationsListener(): Promise<void> {

        (this.VPContract as FlrContract.VPContract).on(this.VPContract.filters.Delegate, async (
            from: string,
            to: string,
            priorVotePower: bigint,
            newVotePower: bigint,
            event: ContractEventPayload,
        ) => {
            let delegation: Delegation = new Delegation();
            delegation.from = from;
            delegation.to = to;
            delegation.amount = Number(ethers.formatEther(newVotePower));
            delegation.blockNumber = event.log.blockNumber;
            delegation.timestamp = await this._getTimestampFromBlockNumber(event.log.blockNumber);
            this.delegationsListener$.next(delegation)
        })
        return Promise.resolve();
    }
    startClaimedRewardsListener(): Promise<void> {
        (this.ftsoRewardManager as FlrContract.FtsoRewardManager).on(this.ftsoRewardManager.filters.RewardClaimed, async (
            dataProvider: string,
            whoClaimed: string,
            sentTo: string,
            rewardEpoch: bigint,
            amount: bigint,
            event: ContractEventPayload,
        ) => {
            let claimedReward: Reward = new Reward();
            claimedReward.whoClaimed = whoClaimed;
            claimedReward.dataProvider = dataProvider;
            claimedReward.sentTo = sentTo;
            claimedReward.rewardEpochId = Number(rewardEpoch);
            claimedReward.amount = Number(ethers.formatEther(amount));
            claimedReward.blockNumber = event.log.blockNumber;
            claimedReward.timestamp = await this._getTimestampFromBlockNumber(event.log.blockNumber);
            this.claimedRewardsListener$.next(claimedReward)
        });
        return Promise.resolve();
    }


    @Process({ name: 'scanClaimedRewardsProcessor', concurrency: 1 })
    async scanClaimedRewardsProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this.scanClaimedRewards(job.data['startBlock'], job.data['endBlock'], job.data['address'])
                .then(res => {
                    let results: Reward[] = [];
                    if (res.length > 0) {
                        for (let idx in res) {
                            let evt: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>> = res[idx];
                            let claimedReward: Reward = new Reward();
                            claimedReward.blockNumber = Number(evt.blockNumber);
                            claimedReward.rewardEpochId = Number(evt.args.rewardEpoch);
                            claimedReward.whoClaimed = evt.args.whoClaimed;
                            claimedReward.sentTo = evt.args.sentTo;
                            claimedReward.dataProvider = evt.args.dataProvider;
                            claimedReward.amount = Number(ethers.formatEther(evt.args.amount));
                            results.push(claimedReward);
                        };
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    getClaimedRewards(address: string, startBlock: number, endBlock: number): Promise<Reward[]> {
        return new Promise<Array<Reward>>(async (resolve, reject) => {
            try {
                const job = await this._blockchainDaoQueue.add('scanClaimedRewardsProcessor', { startBlock, endBlock, address });
                let results: Array<Reward> = await job.finished() as Array<Reward>;

                this.logger.log(`scanClaimedRewards - getting timestamps...`)
                this._blockNumberTimestampCache = {};
                const claimedRewardsTimestamp: Array<number> = await this._makeBatchedCalls(5000, 10, this._getTimestampFromBlockNumber.bind(this), results.map((evt) => [evt.blockNumber]));
                claimedRewardsTimestamp.map((delegationTimestamp, idx) => {
                    results[idx].timestamp = delegationTimestamp;
                });
                resolve(results);
            } catch (err) {
                this.logger.error(`Error while fetching RewardClaimed for address '${address}': ${err.message}`);
                reject(`Unable to get claimed rewards for address '${address}' from the blockchain.`);
            }
        });
    }
    abstract scanClaimedRewards(blockStart: number, blockEnd: number, whoClaimed: string, progessId?: string): Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[]>;


    getRewardEpochSettings(): Promise<RewardEpochSettings> {
        return new Promise<RewardEpochSettings>(async (resolve, reject) => {
            try {
                if (isEmpty(this._rewardEpochSettings)) {
                    let rewardEpochSettingsData: RewardEpochSettings = new RewardEpochSettings();
                    rewardEpochSettingsData.firstEpochStartTime = Number(await this.ftsoManager.rewardEpochsStartTs()) * 1000;
                    rewardEpochSettingsData.rewardEpochDurationMillis = Number(await this.ftsoManager.rewardEpochDurationSeconds()) * 1000;
                    resolve(rewardEpochSettingsData);
                } else {
                    resolve(this._rewardEpochSettings);
                }
            } catch (err) {
                this.logger.error(`Cannot get rewardEpochSettings: ${err.message}`);
                reject(`Cannot get rewardEpochSettings.`);
            }
        });
    }

    getPriceEpochSettings(): Promise<PriceEpochSettings> {
        return new Promise<PriceEpochSettings>(async (resolve, reject) => {
            try {
                if (isEmpty(this._priceEpochSettings)) {
                    let priceEpochSettingsData: PriceEpochSettings = new PriceEpochSettings();
                    let priceEpochConfiguration: {
                        _firstPriceEpochStartTs: bigint;
                        _priceEpochDurationSeconds: bigint;
                        _revealEpochDurationSeconds: bigint;
                    } = await this.ftsoManager.getPriceEpochConfiguration();
                    priceEpochSettingsData.firstEpochStartTime = Number(priceEpochConfiguration._firstPriceEpochStartTs) * 1000;
                    priceEpochSettingsData.priceEpochDurationMillis = Number(priceEpochConfiguration._priceEpochDurationSeconds) * 1000;
                    priceEpochSettingsData.revealEpochDurationMillis = Number(priceEpochConfiguration._revealEpochDurationSeconds) * 1000;
                    resolve(priceEpochSettingsData);
                } else {
                    resolve(this._priceEpochSettings);
                }
            } catch (err) {
                this.logger.error(`Cannot get priceEpochSettings: ${err.message}`);
                reject(`Cannot get priceEpochSettings.`);
            }
        });
    }

    private async _getTimestampFromBlockNumber(blockNumber: number): Promise<number> {
        try {
            if (isEmpty(this._blockNumberTimestampCache[blockNumber])) {
                let blockInfo: ethers.Block = await this.provider.getBlock(blockNumber);
                this._blockNumberTimestampCache[blockNumber] = Number(blockInfo.timestamp) * 1000;
            }
            return this._blockNumberTimestampCache[blockNumber];
        } catch (err) {
            throw new Error("Unable to retrieve timestamp from BlockNumber: " + err.message);
        }
    }
    getMaxScanSize(startTime: number, actualScanSize: number, targetTime: number) {
        const timeDiff: number = new Date().getTime() - startTime;
        let newScanSize: number = 0;
        if (timeDiff < targetTime) {
            newScanSize = actualScanSize + (actualScanSize / 100) * 10;
        } else {
            newScanSize = actualScanSize - (actualScanSize / 100) * 50;
        }
        return Math.ceil(newScanSize);
    }
    private async _makeBatchedCalls(
        batchSize: number,
        delayBetweenBatches: number,
        callFunction: CallFunction,
        argsArray: any[][]
    ): Promise<any[]> {
        const results: any[] = [];
        for (let i = 0; i < argsArray.length; i += batchSize) {
            const batchArgs = argsArray.slice(i, i + batchSize);
            const batchPromises = batchArgs.map((args) => callFunction(...args));

            // Esegui le chiamate in batch
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Aggiungi un ritardo tra i batch
            if (i + batchSize < argsArray.length) {
                await Commons.delay(delayBetweenBatches);
            }
        }
        return results;
    }

    startPricesRevealedListener(): Promise<void> {
        (this.priceSubmitter as FlrContract.PriceSubmitter).on((this.priceSubmitter as FlrContract.PriceSubmitter).filters.PricesRevealed, async (
            voter: string,
            epochId: bigint,
            ftsos: string[],
            prices: bigint[],
            random: bigint,
            timestamp: bigint,
            event: any
        ) => {
            ftsos.map((ftso, ftsoIdx) => {
                let priceRevealed: PriceRevealed = new PriceRevealed();
                priceRevealed.blockNumber = event.log.blockNumber;
                priceRevealed.timestamp = Number(timestamp) * 1000;
                priceRevealed.epochId = Number(epochId);
                priceRevealed.symbol = this.ftsoManagerWrapper.getSymbolByContractAddress(ftso);
                priceRevealed.value = (Number(prices[ftsoIdx]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(ftso));
                priceRevealed.dataProvider = voter;
                this.pricesRevealedListener$.next(priceRevealed);
            });
        })
        return Promise.resolve();
    }
    abstract startHashSubmittedListener(): Promise<void>;

    startWrappedBalanceListener(): Promise<void> {
        (this.wnat as FlrContract.WNat).on(this.wnat.filters.Transfer, async (
            from: string,
            to: string,
            value: bigint,
            event: ContractEventPayload,
        ) => {
            let results: Balance[] = [];
            results.push(...this._parseTransactions(event.log as any));
            this._blockNumberTimestampCache = {};
            const balanceTimestamps: Array<number> = await this._makeBatchedCalls(5000, 10, this._getTimestampFromBlockNumber.bind(this), results.map((evt) => [evt.blockNumber]));
            balanceTimestamps.map((balanceTimestamp, idx) => {
                results[idx].timestamp = balanceTimestamp;
            });
            results.sort((a, b) => a.blockNumber - b.blockNumber);
            results.map(r => {
                this.wrappedBalanceListener$.next(r)
            });
        });
        return Promise.resolve();
    }
    getBalances(address: string, startBlock: number, endBlock: number): Promise<Balance[]> {
        return new Promise<Balance[]>(async (resolve, reject) => {
            try {
                const job = await this._blockchainDaoQueue.add('scanDepositsAndWithdrawalsProcessor', { startBlock, endBlock, address });
                let results: Balance[] = await job.finished() as Balance[];

                this.logger.log(`_scanBalances - getting timestamps...`)
                this._blockNumberTimestampCache = {};
                const balanceTimestamps: Array<number> = await this._makeBatchedCalls(5000, 10, this._getTimestampFromBlockNumber.bind(this), results.map((evt) => [evt.blockNumber]));
                balanceTimestamps.map((balanceTimestamp, idx) => {
                    results[idx].timestamp = balanceTimestamp;
                });
                results.sort((a, b) => a.blockNumber - b.blockNumber);
                resolve(results);
            } catch (err) {
                this.logger.error(`Error while fetching Deposit and Withdrawal events': ${err.message}`);
                reject(`Unable to get delegation events for address from the blockchain.`);
            }
        });
    }
    private _parseTransactions(event: FlrWNat.TransferEvent.Log): Balance[] {
        let results: Balance[] = [];
        if (event.args.to == '0x0000000000000000000000000000000000000000') { // Withdrawal
            let withdrawal: Balance = new Balance();
            withdrawal.blockNumber = event.blockNumber;
            withdrawal.addressA = event.args.from;
            withdrawal.addressB = event.args.to;
            withdrawal.amount = -Number(ethers.formatEther(event.args.value));
            withdrawal.nonce = event.index + '_' + event.transactionIndex;
            results.push(withdrawal);

        } else if (event.args.from == '0x0000000000000000000000000000000000000000') { // Deposit
            let deposit: Balance = new Balance();
            deposit.blockNumber = event.blockNumber;
            deposit.addressA = event.args.to;
            deposit.addressB = event.args.from;
            deposit.amount = Number(ethers.formatEther(event.args.value));
            deposit.nonce = event.index + '_' + event.transactionIndex;
            results.push(deposit);
        } else { // Transfer 
            let transferOut: Balance = new Balance();
            transferOut.blockNumber = event.blockNumber;
            transferOut.addressA = event.args.from;
            transferOut.addressB = event.args.to;
            transferOut.amount = -Number(ethers.formatEther(event.args.value));
            transferOut.nonce = event.index + '_' + event.transactionIndex;
            results.push(transferOut);

            let transferIn: Balance = new Balance();
            transferIn.blockNumber = event.blockNumber;
            transferIn.addressA = event.args.to;
            transferIn.addressB = event.args.from;
            transferIn.amount = Number(ethers.formatEther(event.args.value));
            transferIn.nonce = event.index + '_' + event.transactionIndex;
            results.push(transferIn);
        }
        return results;
    }

    getVoterWhitelist(startBlock: number, endBlock: number): Promise<VoterWhitelist[]> {
        return new Promise<VoterWhitelist[]>(async (resolve, reject) => {
            try {
                const job = await this._blockchainDaoQueue.add('scanVoterWhitelistProcessor', { startBlock, endBlock });
                let results: VoterWhitelist[] = await job.finished() as VoterWhitelist[];
                this.logger.log(`_scanVoterWhitelist - getting timestamps...`)
                this._blockNumberTimestampCache = {};
                const voterWhitelistTimestamps: Array<number> = await this._makeBatchedCalls(5000, 10, this._getTimestampFromBlockNumber.bind(this), results.map((evt) => [evt.blockNumber]));
                voterWhitelistTimestamps.map((delegationTimestamp, idx) => {
                    results[idx].timestamp = delegationTimestamp;
                });
                results.sort((a, b) => a.blockNumber - b.blockNumber);
                resolve(results);
            } catch (err) {
                this.logger.error(`Error while fetching voter whitelist events': ${err.message}`);
                reject(`Unable to get voter whitelist from the blockchain.`);
            }
        });
    }
    @Process({ name: 'scanVoterWhitelistProcessor', concurrency: 1 })
    private async _scanVoterWhitelistProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanVoterWhitelist(job.data['startBlock'], job.data['endBlock'])
                .then(res => {
                    let results: VoterWhitelist[] = [];
                    if (res.length > 0) {
                        if (res[0].length > 0) {
                            for (let idx in res[0]) {
                                const event = res[0][idx];
                                let obj: VoterWhitelist = new VoterWhitelist();
                                obj.blockNumber = event.blockNumber;
                                obj.address = event.args.voter;
                                if (isNotEmpty(event.args.ftsoIndex)) {
                                    obj.symbol = this.ftsoManagerWrapper.getSymbolByIndex(Number(event.args.ftsoIndex));
                                } else {
                                    obj.symbol = 'all';
                                }
                                obj.whitelisted = true;
                                results.push(obj);
                            }
                        }
                        if (res[1].length > 0) {
                            for (let idx in res[1]) {
                                const event = res[1][idx];
                                let obj: VoterWhitelist = new VoterWhitelist();
                                obj.blockNumber = event.blockNumber;
                                obj.address = event.args.voter;
                                if (isNotEmpty(event.args.ftsoIndex)) {
                                    obj.symbol = this.ftsoManagerWrapper.getSymbolByIndex(Number(event.args.ftsoIndex));
                                } else {
                                    obj.symbol = 'all';
                                }
                                obj.whitelisted = false;
                                results.push(obj);
                            }
                        }
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    private async _scanVoterWhitelist(startBlock: number, endBlock: number): Promise<[FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterWhitelistedEvent.InputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputObject>>[], FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.InputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputObject>>[]]> {
        return new Promise<[FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterWhitelistedEvent.InputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputObject>>[], FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.InputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputObject>>[]]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 10000;
                let voterWhitelisterContract: FlrContract.VoterWhitelister = this.voterWhitelister;
                let contracts: FlrContract.VoterWhitelister[] = [voterWhitelisterContract];
                const fillOldContracts = async (contract: FlrContract.VoterWhitelister, contracts: FlrContract.VoterWhitelister[]) => {
                    const voterWhitelisterAddress: string = await contract.getAddress();
                    if (voterWhitelisterAddress != '0x0000000000000000000000000000000000000000') {
                        try {
                            const oldVoterWhitelisterAddress: string = await contract.oldVoterWhitelister();
                            const oldVoterWhitelisterContract: FlrContract.VoterWhitelister = FlrContract.VoterWhitelister__factory.connect(oldVoterWhitelisterAddress, this.provider);
                            contracts.push(oldVoterWhitelisterContract);
                            await fillOldContracts(oldVoterWhitelisterContract, contracts);
                        } catch (e) {

                        }
                    }
                };
                await fillOldContracts(voterWhitelisterContract, contracts)
                let whitelistAddResults: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterWhitelistedEvent.InputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputObject>>[] = [];
                let whitelistRemoveResults: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.InputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputObject>>[] = [];
                const processBlocks = async (start: number, end: number, voterWhitelisterContract: FlrContract.VoterWhitelister) => {
                    this.logger.verbose(`_scanVoterWhitelist - Contract: ${await voterWhitelisterContract.getAddress()} - Processing blocks from ${start} to ${end}  - Size: ${maxScanSize}`);
                    const whitelistAddFilter = voterWhitelisterContract.filters.VoterWhitelisted();
                    const whitelistRemoveFilter = voterWhitelisterContract.filters.VoterRemovedFromWhitelist();
                    const startTime: number = new Date().getTime();
                    const addEvents: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterWhitelistedEvent.InputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputTuple, FlrVoterWhitelister.VoterWhitelistedEvent.OutputObject>>[] = await voterWhitelisterContract.queryFilter(whitelistAddFilter, start, end);
                    const removeEvents: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.InputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputTuple, FlrVoterWhitelister.VoterRemovedFromWhitelistEvent.OutputObject>>[] = await voterWhitelisterContract.queryFilter(whitelistRemoveFilter, start, end);
                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 500);
                    whitelistAddResults = whitelistAddResults.concat(addEvents);
                    whitelistRemoveResults = whitelistRemoveResults.concat(removeEvents);
                    if (end < endBlock) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, endBlock), voterWhitelisterContract);
                    }
                };
                for (let i in contracts) {
                    await processBlocks(startBlock, Math.min(startBlock + maxScanSize, endBlock), contracts[i]);
                }

                resolve([whitelistAddResults, whitelistRemoveResults]);
            } catch (e) {
                reject(e);
            }
        });
    }

    startVoterWhitelistListener(): Promise<void> {
        (this.voterWhitelister as FlrContract.VoterWhitelister).on(this.voterWhitelister.filters.VoterWhitelisted, async (
            voter: string,
            ftsoIndex: bigint,
            event: ContractEventPayload,
        ) => {
            let voterWhitelist: VoterWhitelist = new VoterWhitelist();
            voterWhitelist.address = voter;
            voterWhitelist.symbol = this.ftsoManagerWrapper.getSymbolByIndex(Number(ftsoIndex));
            voterWhitelist.whitelisted = true;
            this.voterWhitelistListener$.next(voterWhitelist);
        });
        return Promise.resolve();
    }


    @Process({ name: 'scanDepositsAndWithdrawalsProcessor', concurrency: 1 })
    private async _scanDepositsAndWithdrawalsProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanDepositsAndWithdrawals(job.data['startBlock'], job.data['endBlock'], job.data['address'])
                .then(res => {
                    let results: Balance[] = [];
                    if (res.length > 0) {
                        for (let idx in res) {
                            results.push(...this._parseTransactions(res[idx]));
                        }
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    private async _scanDepositsAndWithdrawals(startBlock: number, endBlock: number, address: string): Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrWNat.TransferEvent.InputTuple, FlrWNat.TransferEvent.OutputTuple, FlrWNat.TransferEvent.OutputObject>>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrWNat.TransferEvent.InputTuple, FlrWNat.TransferEvent.OutputTuple, FlrWNat.TransferEvent.OutputObject>>[]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 100;
                let wnatContract: FlrContract.WNat = this.wnat as FlrContract.WNat;
                let results: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrWNat.TransferEvent.InputTuple, FlrWNat.TransferEvent.OutputTuple, FlrWNat.TransferEvent.OutputObject>>[] = [];
                let depositFrom: string = null;
                let depositTo: string = null;
                let withdrawalFrom: string = null;
                let withdrawalTo: string = null;
                if (!isEmpty(address)) {
                    depositFrom = null;
                    depositTo = address;
                    withdrawalFrom = address;
                    withdrawalTo = null;
                }
                const processBlocks = async (start: number, end: number, wnatContract: FlrContract.WNat, address) => {
                    this.logger.verbose(`_scanBalances - Contract: ${await wnatContract.getAddress()} - Address: ${isNotEmpty(address) ? address : '*'} Processing blocks from ${start} to ${end}  - Size: ${maxScanSize}`);
                    const depositFilter = wnatContract.filters.Transfer(depositFrom, depositTo);
                    const withdrawalFilter = wnatContract.filters.Transfer(withdrawalFrom, withdrawalTo);

                    const startTime: number = new Date().getTime();
                    const depositEvents: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrWNat.TransferEvent.InputTuple, FlrWNat.TransferEvent.OutputTuple, FlrWNat.TransferEvent.OutputObject>>[] = await wnatContract.queryFilter(depositFilter, start, end);
                    const withdrawalEvents: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrWNat.TransferEvent.InputTuple, FlrWNat.TransferEvent.OutputTuple, FlrWNat.TransferEvent.OutputObject>>[] = await wnatContract.queryFilter(withdrawalFilter, start, end);

                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 500);
                    results = results.concat(depositEvents);
                    results = results.concat(withdrawalEvents);
                    if (end < endBlock) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, endBlock), wnatContract, address);
                    }
                };
                await processBlocks(startBlock, Math.min(startBlock + maxScanSize, endBlock), wnatContract, address);
                resolve(results);
            } catch (e) {
                reject(e);
            }
        });
    }

    abstract getSubmittedHashes(blockNumberStart: number, blockNumberEnd: number): Promise<HashSubmitted[]>
   

    async getFinalizedPrices(symbol: string, blockNumberStart: number, blockNumberEnd: number): Promise<PriceFinalized[]> {
        try {
            if (blockNumberEnd == null) {
                blockNumberEnd = await this.provider.getBlockNumber();
            }
            const filteredFtsoContracts: { [symbol: string]: DynamicFtso[] } = this.ftsoManagerWrapper.getContractsByBlockNumberRange(blockNumberStart, blockNumberEnd);
            var dynamicFtsoContracts: DynamicFtso[] = [];
            if (isNotEmpty(symbol)) {
                if (filteredFtsoContracts[symbol]) {
                    dynamicFtsoContracts.push(...filteredFtsoContracts[symbol]);
                }
            } else {
                for (let symbol in filteredFtsoContracts) {
                    dynamicFtsoContracts.push(...filteredFtsoContracts[symbol]);
                }
            }

            const events: PriceFinalized[] = [];
            for (const contract of dynamicFtsoContracts) {
                const { activeFromBlock, activeToBlock } = contract;
                let startBlock = activeFromBlock;
                let endBlock = activeToBlock || blockNumberEnd;

                if (startBlock <= blockNumberEnd && endBlock >= blockNumberStart) {
                    startBlock = Math.max(startBlock, blockNumberStart);
                    endBlock = Math.min(endBlock, blockNumberEnd);
                    const job = await this._blockchainDaoQueue.add('scanFinalizedPricesProcessor', { contract, startBlock, endBlock });
                    const evts: PriceFinalized[] = await job.finished() as PriceFinalized[];
                    events.push(...evts);
                }
            }
            return events;
        } catch (err) {
            throw err;
        }
    }
    @Process({ name: 'scanFinalizedPricesProcessor', concurrency: 1 })
    private async scanFinalizedPricesProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanFinalizedPrices(job.data['contract'], job.data['startBlock'], job.data['endBlock'])
                .then(res => {
                    let results: PriceFinalized[] = [];
                    if (res.length > 0) {
                        results = res.map(evt => {
                            let finalizedPrice: PriceFinalized = new PriceFinalized();
                            finalizedPrice.epochId = Number(evt.args[0]);
                            finalizedPrice.blockNumber = evt.blockNumber;
                            finalizedPrice.rewardedSymbol = Boolean(evt.args[2]);
                            finalizedPrice.symbol = this.ftsoManagerWrapper.getSymbolByContractAddress(job.data['contract'].address);
                            if ((evt as any).hasElasticBand) {
                                finalizedPrice.timestamp = Number(evt.args[8]) * 1000;
                                finalizedPrice.value = (Number(evt.args[1]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                                finalizedPrice.lowIQRRewardPrice = (Number(evt.args[3]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                                finalizedPrice.highIQRRewardPrice = (Number(evt.args[4]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                                finalizedPrice.lowPctRewardPrice = (Number(evt.args[5]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                                finalizedPrice.highPctRewardPrice = (Number(evt.args[6]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                            } else {
                                finalizedPrice.timestamp = Number(evt.args[6]) * 1000;
                                finalizedPrice.value = (Number(evt.args[1]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                                finalizedPrice.lowIQRRewardPrice = (Number(evt.args[3]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                                finalizedPrice.highIQRRewardPrice = (Number(evt.args[4]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(job.data['contract'].address));
                            }
                            return finalizedPrice;
                        });
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }


    private async _scanFinalizedPrices(dynamicFtso: DynamicFtso, blockNumberStart: number, blockNumberEnd: number): Promise<FlrContractCommon.TypedEventLog<any>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<any>[]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 250;
                let results: FlrContractCommon.TypedEventLog<any>[] = [];
                let contract: FlrContract.Ftso | FlrContract.FtsoOld;
                let filter: any;
                if (dynamicFtso.hasElasticBand) {
                    contract = FlrContract.Ftso__factory.connect(dynamicFtso.address, this.provider);
                    filter = contract.filters.PriceFinalized();
                } else {
                    contract = contract = FlrContract.FtsoOld__factory.connect(dynamicFtso.address, this.provider);
                    filter = contract.filters.PriceFinalized();
                }
                const processBlocks = async (start: number, end: number, contract: FlrContract.Ftso | FlrContract.FtsoOld, filter: any) => {
                    this.logger.verbose(`_scanFinalizedPrices - Contract: ${dynamicFtso.address} - Processing blocks from ${start} to ${end}  - Size: ${maxScanSize}`);
                    const startTime: number = new Date().getTime();
                    const priceFinalizedEvents: FlrContractCommon.TypedEventLog<any>[] = await contract.queryFilter(filter, start, end);
                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 250);
                    if (dynamicFtso.hasElasticBand) {
                        priceFinalizedEvents.map(e => (e as any).hasElasticBand = true);
                    } else {
                        priceFinalizedEvents.map(e => (e as any).hasElasticBand = false);
                    }
                    results = results.concat(priceFinalizedEvents);
                    if (end < blockNumberEnd) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, blockNumberEnd), contract, filter);
                    }
                };
                await processBlocks(blockNumberStart, Math.min(blockNumberStart + maxScanSize, blockNumberEnd), contract, filter);
                resolve(results);
            } catch (e) {
                reject(e);
            }
        });
    }

    async getRevealedPrices(dataProvider: string, blockNumberStart: number, blockNumberEnd: number): Promise<PriceRevealed[]> {
        try {
            if (blockNumberEnd == null) {
                blockNumberEnd = await this.provider.getBlockNumber();
            }
            const job = await this._blockchainDaoQueue.add('scanRevealedPricesProcessor', { dataProvider, blockNumberStart, blockNumberEnd });
            const events: PriceRevealed[] = await job.finished() as PriceRevealed[];
            return events;
        } catch (err) {
            throw err;
        }
    }
    @Process({ name: 'scanRevealedPricesProcessor', concurrency: 1 })
    private async scanRevealedPricesProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanRevealedPrices(job.data['dataProvider'], job.data['blockNumberStart'], job.data['blockNumberEnd'])
                .then(res => {
                    let results: PriceRevealed[] = [];
                    if (res.length > 0) {
                        this.logger.verbose(`_scanRevealedPrices - Processing events...`);
                        for (let evt of res) {

                            for (let argIndex in evt.args[2]) {
                                let revealedPrice: PriceRevealed = new PriceRevealed();
                                revealedPrice.epochId = Number(evt.args[1]);
                                revealedPrice.blockNumber = evt.blockNumber;
                                revealedPrice.timestamp = Number(evt.args[5]) * 1000;
                                revealedPrice.symbol = this.ftsoManagerWrapper.getSymbolByContractAddress(evt.args[2][argIndex]);
                                revealedPrice.value = (Number(evt.args[3][argIndex]) / 10 ** this.ftsoManagerWrapper.getDecimalsByContractAddress(evt.args[2][argIndex]))
                                revealedPrice.dataProvider = evt.args[0].toLowerCase();
                                results.push(revealedPrice);
                            }
                        }
                    }
                    this.logger.verbose(`_scanRevealedPrices - Processing events finished.`);
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }


    private async _scanRevealedPrices(address: string, blockNumberStart: number, blockNumberEnd: number): Promise<FlrContractCommon.TypedEventLog<any>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<any>[]>(async (resolve, reject) => {
            try {
                const contractAddress: string = await this.priceSubmitter.getAddress();
                let filter: any = (this.priceSubmitter as FlrContract.PriceSubmitter).filters.PricesRevealed(address, null, null);
                let maxScanSize: number = 500;
                let results: FlrContractCommon.TypedEventLog<any>[] = [];

                while (blockNumberStart <= blockNumberEnd) {
                    const endBlock = Math.min(blockNumberStart + maxScanSize, blockNumberEnd);
                    this.logger.verbose(`_scanRevealedPrices - Contract: ${contractAddress} - Processing blocks from ${blockNumberStart} to ${endBlock}  - Size: ${maxScanSize}`);
                    let startTime: number = new Date().getTime();
                    const priceFinalizedEvents: FlrContractCommon.TypedEventLog<any>[] = await (this.priceSubmitter as FlrContract.PriceSubmitter).queryFilter(filter, blockNumberStart, endBlock);
                    results = results.concat(priceFinalizedEvents);

                    blockNumberStart = endBlock + 1;
                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 250);
                }

                resolve(results);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getFtsoFee(dataProvider: string, startBlock: number, endBlock: number): Promise<FtsoFee[]> {
        try {
            const job = await this._blockchainDaoQueue.add('scanFtsoFeeProcessor', { dataProvider, startBlock, endBlock });
            const events: FtsoFee[] = await job.finished() as FtsoFee[];
            return events;
        } catch (err) {
            throw err;
        }
    }
    @Process({ name: 'scanFtsoFeeProcessor', concurrency: 1 })
    private async scanFtsoFeeProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this.scanFtsoFee(job.data['dataProvider'], job.data['startBlock'], job.data['endBlock'])
                .then(async res => {
                    let results: FtsoFee[] = [];
                    for (let idx in res) {
                        let evt = res[idx];
                        if (typeof (evt as any).ftsoDefaultFeePlaceholder == 'undefined') {
                            let ftsoFee: FtsoFee = new FtsoFee();
                            ftsoFee.dataProvider = evt.args[0].toLowerCase();
                            ftsoFee.validFromEpoch = Number(evt.args[2]);
                            ftsoFee.value = Number(evt.args[1]) / 100;
                            ftsoFee.blockNumber = evt.blockNumber;
                            ftsoFee.timestamp = await this._getTimestampFromBlockNumber(Number(evt.blockNumber));
                            results.push(ftsoFee);
                        }
                    }
                    if (results.length > 0) {
                        for (let idx in res) {
                            let evt = res[idx];
                            if (typeof (evt as any).ftsoDefaultFeePlaceholder != 'undefined') {
                                let ftsoFee: FtsoFee = new FtsoFee();
                                ftsoFee.dataProvider = 'defaultFtsoFee';
                                ftsoFee.value = 20;
                                ftsoFee.blockNumber = evt.blockNumber;
                                ftsoFee.validFromEpoch = Number((evt as any).ftsoDefaultFeePlaceholder);
                                ftsoFee.timestamp = await this._getTimestampFromBlockNumber(Number(evt.blockNumber));
                                results.push(ftsoFee);
                            }
                        }
                    }
                    results.sort((a, b) => a.timestamp - b.timestamp)
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    abstract scanFtsoFee(address: string, blockNumberStart: number, blockNumberEnd: number): Promise<FlrContractCommon.TypedEventLog<any>[]>;
    startFtsoFeeListener(): Promise<void> {
        (this.ftsoRewardManager as FlrContract.FtsoRewardManager).on(this.ftsoRewardManager.filters.FeePercentageChanged, async (
            dataProvider: string,
            value: bigint,
            validFromEpoch: bigint,
            event: ContractEventPayload
        ) => {
            let ftsoFee: FtsoFee = new FtsoFee();
            ftsoFee.dataProvider = dataProvider;
            ftsoFee.value = Number(ethers.formatEther(value));
            ftsoFee.validFromEpoch = Number(validFromEpoch);
            ftsoFee.blockNumber = event.log.blockNumber;
            ftsoFee.timestamp = await this._getTimestampFromBlockNumber(event.log.blockNumber);
        });
        return Promise.resolve();
    }


    async getRewardDistributed(startBlock: number, endBlock: number): Promise<RewardDistributed[]> {
        try {
            const job = await this._blockchainDaoQueue.add('scanRewardDistributedProcessor', { startBlock, endBlock });
            const events: RewardDistributed[] = await job.finished() as RewardDistributed[];
            if (events.length > 0) {
                this.logger.log(`_scanRewardDistributed - getting timestamps...`)
                this._blockNumberTimestampCache = {};
                const rewardDistributedTimestamps: Array<number> = await this._makeBatchedCalls(5000, 10, this._getTimestampFromBlockNumber.bind(this), events.map((evt) => [evt.blockNumber]));
                rewardDistributedTimestamps.map((rewardDistributedTimestamp, idx) => {
                    events[idx].timestamp = rewardDistributedTimestamp;
                });
            }
            events.sort((a, b) => a.blockNumber - b.blockNumber);
            return events;
        } catch (err) {
            throw err;
        }
    }

    @Process({ name: 'scanRewardDistributedProcessor', concurrency: 1 })
    private async scanRewardDistributedProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanRewardDistributed(job.data['startBlock'], job.data['endBlock'])
                .then(async res => {
                    let results: RewardDistributed[] = [];
                    for (let idx in res) {
                        let evt = res[idx];
                        if (evt.args[2] && evt.args[2].length > 0) {
                            for (let addressIdx in evt.args[2]) {
                                let dataProviderAddress: string = evt.args[2][addressIdx];
                                let rewardDistributed: RewardDistributed = new RewardDistributed();
                                rewardDistributed.dataProvider = dataProviderAddress.toLowerCase();
                                rewardDistributed.priceEpochId = Number(evt.args[1]);
                                rewardDistributed.symbol = this.ftsoManagerWrapper.getSymbolByContractAddress(evt.args[0]);
                                rewardDistributed.reward = Number(ethers.formatEther(evt.args[3][addressIdx]));
                                rewardDistributed.blockNumber = evt.blockNumber;
                                results.push(rewardDistributed);
                            }
                        }
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    private async _scanRewardDistributed(blockNumberStart: number, blockNumberEnd: number): Promise<FlrContractCommon.TypedEventLog<any>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<any>[]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 5000;
                let results: FlrContractCommon.TypedEventLog<any>[] = [];
                const contractAddress: string = await this.ftsoRewardManager.getAddress();
                let filter: any = this.ftsoRewardManager.filters.RewardsDistributed(null, null, null);
                const processBlocks = async (start: number, end: number, contract: FlrContract.FtsoRewardManager, contractAddress: string, filter: any) => {
                    this.logger.verbose(`_scanRewardDistributed - Contract: ${contractAddress} - Processing blocks from ${start} to ${end}  - Size: ${maxScanSize}`);
                    const startTime: number = new Date().getTime();
                    const rewardDistributed: FlrContractCommon.TypedEventLog<any>[] = await contract.queryFilter(filter, start, end);
                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 500);
                    results = results.concat(rewardDistributed);
                    if (end < blockNumberEnd) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, blockNumberEnd), contract, contractAddress, filter);
                    }
                };
                await processBlocks(blockNumberStart, Math.min(blockNumberStart + maxScanSize, blockNumberEnd), this.ftsoRewardManager, contractAddress, filter);
                resolve(results);
            } catch (e) {
                reject(e);
            }
        });
    }
    startRewardDistributedListener(): Promise<void> {
        (this.ftsoRewardManager as FlrContract.FtsoRewardManager).on((this.ftsoRewardManager as FlrContract.FtsoRewardManager).filters.RewardsDistributed, async (
            ftso: string,
            epochId: bigint,
            addresses: string[],
            rewards: bigint[],
            evt: any
        ) => {
            addresses.map(async (address, addressIdx) => {
                let rewardDistributed: RewardDistributed = new RewardDistributed();
                rewardDistributed.dataProvider = address;
                rewardDistributed.priceEpochId = Number(epochId);
                rewardDistributed.symbol = this.ftsoManagerWrapper.getSymbolByContractAddress(ftso);
                rewardDistributed.reward = Number(ethers.formatEther(rewards[addressIdx]));
                rewardDistributed.blockNumber = evt.log.blockNumber;
                rewardDistributed.timestamp = await this._getTimestampFromBlockNumber(evt.log.blockNumber);
                this.rewardDistributedListener$.next(rewardDistributed);
            });

        })
        return Promise.resolve();
    }
}