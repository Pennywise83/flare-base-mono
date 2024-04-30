import { FlrContract, FlrContractCommon, FlrFtsoRewardManager, HashSubmitted, NetworkEnum } from "@flare-base/commons";
import { InjectQueue, Process, Processor } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NetworkConfig } from "apps/backend/src/model/app-config/network-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { Job, Queue } from "bull";
import { isEmpty, isNotEmpty } from "class-validator";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from 'fs';
import { FtsoManagerWrapper } from "../model/ftso-manager-wrapper";
import { BlockchainDaoImpl } from "./blockchain-dao.impl.service";

export const BLOCKCHAIN_DAO_FLR = 'BLOCKCHAIN_DAO_FLR';
export const BLOCKCHAIN_DAO_FLR_QUEUE = 'BLOCKCHAIN_DAO_FLR_QUEUE';

@Processor(BLOCKCHAIN_DAO_FLR_QUEUE)
@Injectable()
export class BlockchainDaoFlrImpl extends BlockchainDaoImpl {
    logger: Logger = new Logger(BlockchainDaoFlrImpl.name);


    constructor(private _configService: ConfigService, @InjectQueue(BLOCKCHAIN_DAO_FLR_QUEUE) _blockchainDaoQueue: Queue) {
        super();

        const networkConfig: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
        if (networkConfig.find(nConfig => nConfig.name == NetworkEnum.flare)) {
            this.logger.log("Initializing Blockchain DAO");
            this.status = ServiceStatusEnum.INITIALIZING;
            this._blockchainDaoQueue = _blockchainDaoQueue;
            this.config = networkConfig.find(nConfig => nConfig.name == NetworkEnum.flare).blockchainDao;
            this.initialize().then(() => this.status = ServiceStatusEnum.STARTED).catch((err) => {
                this.logger.error(`Unable to initizlie Blockchain DAO`, err.message);
                this.status = ServiceStatusEnum.STOPPED;
                return;
            });
        } else {
            this.logger.log(`No configuration provided`);
            this.status = ServiceStatusEnum.STOPPED
        }


    }
    async initialize(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                if (this.config.rpcUrl.startsWith("http")) {
                    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
                } else if (this.config.rpcUrl.startsWith("ws")) {
                    this.provider = new ethers.WebSocketProvider(this.config.rpcUrl);
                }
                await this.provider.getNetwork();
            } catch (e) {
                this.provider = null;
                reject(new Error(`Unable to connect to '${this.config.rpcUrl}': ${e.message}`));
            }
            try {
                this.priceSubmitter = FlrContract.PriceSubmitter__factory.connect(this.config.priceSubmitterContractAddress, this.provider);
                this.addressUpdater = FlrContract.AddressUpdater__factory.connect(await this.priceSubmitter.getAddressUpdater(), this.provider);
                let contractAddressesAndNames: { _contractNames: string[]; _contractAddresses: string[]; } = await this.addressUpdater.getContractNamesAndAddresses();
                contractAddressesAndNames._contractNames.map((contractName, idx) => this.contractsList[contractName] = contractAddressesAndNames._contractAddresses[idx]);
                this.ftsoRewardManager = FlrContract.FtsoRewardManager__factory.connect(this.contractsList['FtsoRewardManager'], this.provider);
                this.ftsoManager = FlrContract.FtsoManager__factory.connect(this.contractsList['FtsoManager'], this.provider);
                this.wnat = FlrContract.WNat__factory.connect(this.contractsList['WNat'], this.provider);
                this.VPContract = FlrContract.VPContract__factory.connect(await this.wnat.readVotePowerContract(), this.provider);
                this.voterWhitelister = FlrContract.VoterWhitelister__factory.connect(this.contractsList['VoterWhitelister'], this.provider);
                if (isNotEmpty(this.config.ftsoManagerWrapperPath)) {
                    try {
                        this.ftsoManagerWrapper = JSON.parse(readFileSync(this.config.ftsoManagerWrapperPath, 'utf8'));
                        this.ftsoManagerWrapper.logger = this.logger;
                        this.ftsoManagerWrapper.getContractsByBlockNumberRange = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getContractsByBlockNumberRange;
                        this.ftsoManagerWrapper.getSymbolByContractAddress = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getSymbolByContractAddress;
                        this.ftsoManagerWrapper.getSymbolByIndex = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getSymbolByIndex;
                        this.ftsoManagerWrapper.getDecimalsByContractAddress = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getDecimalsByContractAddress;
                        this.ftsoManagerWrapper.getContractAddressBySymbol = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getContractAddressBySymbol;

                    } catch (fsErr) {
                        this.ftsoManagerWrapper = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger);
                        await this.ftsoManagerWrapper.initialize();
                        writeFileSync(this.config.ftsoManagerWrapperPath, this.ftsoManagerWrapper.toString());
                    }
                } else {
                    this.ftsoManagerWrapper = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger);
                    await this.ftsoManagerWrapper.initialize();
                }
                if (isEmpty(this.config.missingPriceEpochTreshold)) {
                    this.config.missingPriceEpochTreshold = 0;
                }

                this.logger.log("Blockchain DAO initialized");
                resolve();
            } catch (e) {
                reject(new Error(`Unable to initialize smart contracts: ${e.message}`));
            }
        });
    }
    async scanFtsoFee(address: string, blockNumberStart: number, blockNumberEnd: number): Promise<FlrContractCommon.TypedEventLog<any>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<any>[]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 10000;
                let results: FlrContractCommon.TypedEventLog<any>[] = [];
                let contractsBlockNumberList = [];

                const fillContractsBlockNumberList = async (contract: FlrContract.FtsoRewardManager) => {
                    const rewardManagerAddress: string = await contract.getAddress();
                    if (rewardManagerAddress != '0x0000000000000000000000000000000000000000') {
                        try {
                            const oldAddress: string = await contract.oldFtsoRewardManager();
                            const initialRewardEpoch: number = Number(await contract.getInitialRewardEpoch());
                            const initialRewardEpochBlockNumber = (await this.getRewardEpoch(initialRewardEpoch)).blockNumber;
                            contractsBlockNumberList.push({
                                contract: contract,
                                address: rewardManagerAddress,
                                initialRewardEpochBlockNumber: initialRewardEpochBlockNumber,
                                initialRewardEpoch: initialRewardEpoch
                            });
                            let oldFtsoRewardManager: FlrContract.FtsoRewardManager = FlrContract.FtsoRewardManager__factory.connect(oldAddress, this.provider);
                            await fillContractsBlockNumberList(oldFtsoRewardManager);
                        } catch (e) {
                            this.logger.warn(`Unable to get old reward manager`, e.message);
                        }
                    }
                };
                await fillContractsBlockNumberList(this.ftsoRewardManager)
                contractsBlockNumberList.sort((a, b) => b.initialRewardEpochBlockNumber - a.initialRewardEpochBlockNumber);
                let contractsBlockNumberRanges = [];
                for (let i = 0; i < contractsBlockNumberList.length; i++) {
                    const current = contractsBlockNumberList[i];
                    const previous = contractsBlockNumberList[i - 1];
                    const range = {
                        "contract": current.contract,
                        "address": current.address,
                        "from": current.initialRewardEpochBlockNumber,
                        "to": await this.provider.getBlockNumber(),
                        "initialRewardEpoch": current.initialRewardEpoch
                    };
                    if (previous) {
                        range.to = previous.initialRewardEpochBlockNumber;
                    }
                    contractsBlockNumberRanges.push(range);
                }
                const processBlocks = async (start: number, end: number) => {
                    let ranges = contractsBlockNumberRanges.filter(br => br.from <= end && br.to >= start);
                    for (let idx in ranges) {
                        const range = ranges[idx];
                        this.logger.verbose(`scanFtsoFee - Contract: ${range.address} - Processing blocks from ${start} to ${end} - Size: ${maxScanSize}`);
                        const startTime: number = new Date().getTime();
                        const filter = range.contract.filters["FeePercentageChanged(address,uint256,uint256)"](address, null, null);
                        let events: FlrContractCommon.TypedEventLog<any>[] = await range.contract.queryFilter(filter, start, end);
                        results = results.concat(events);
                        maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 200);
                    }
                    if (end < blockNumberEnd) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, blockNumberEnd));
                    }
                };
                let defaultFtsoFees: any[] = [];
                contractsBlockNumberRanges.map(range => {
                    let evt: any = {};
                    evt.blockNumber = range.from;
                    evt.ftsoDefaultFeePlaceholder = range.initialRewardEpoch;
                    defaultFtsoFees.push(evt);
                });
                results = results.concat(defaultFtsoFees);
                await processBlocks(blockNumberStart, Math.min(blockNumberStart + maxScanSize, blockNumberEnd));
                resolve(results);
            } catch (e) {
                reject(e);
            }
        });
    }
    async scanClaimedRewards(blockStart: number, blockEnd: number, address: string, requestId?: string): Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[]>(async (resolve, reject) => {
            try {
                let results: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = [];
                let maxScanSize: number = 100;
                let contractsBlockNumberList = [];

                const fillContractsBlockNumberList = async (contract: FlrContract.FtsoRewardManager) => {
                    const rewardManagerAddress: string = await contract.getAddress();
                    if (rewardManagerAddress != '0x0000000000000000000000000000000000000000') {
                        try {
                            const oldAddress: string = await contract.oldFtsoRewardManager();
                            const initialRewardEpoch: number = Number(await contract.getInitialRewardEpoch());
                            const initialRewardEpochBlockNumber = (await this.getRewardEpoch(initialRewardEpoch)).blockNumber;
                            contractsBlockNumberList.push({
                                contract: contract,
                                address: rewardManagerAddress,
                                initialRewardEpochBlockNumber: initialRewardEpochBlockNumber
                            });
                            let oldFtsoRewardManager: FlrContract.FtsoRewardManager = FlrContract.FtsoRewardManager__factory.connect(oldAddress, this.provider);
                            await fillContractsBlockNumberList(oldFtsoRewardManager);
                        } catch (e) {
                            this.logger.warn(`Unable to get old reward manager`, e.message);
                        }
                    }
                };
                await fillContractsBlockNumberList(this.ftsoRewardManager)
                contractsBlockNumberList.sort((a, b) => b.initialRewardEpochBlockNumber - a.initialRewardEpochBlockNumber);
                let contractsBlockNumberRanges = [];

                for (let i = 0; i < contractsBlockNumberList.length; i++) {
                    const current = contractsBlockNumberList[i];
                    const previous = contractsBlockNumberList[i - 1];
                    const range = {
                        "contract": current.contract,
                        "address": current.address,
                        "from": current.initialRewardEpochBlockNumber,
                        "to": await this.provider.getBlockNumber()
                    };
                    if (previous) {
                        range.to = previous.initialRewardEpochBlockNumber;
                    }
                    contractsBlockNumberRanges.push(range);
                }

                const processBlocks = async (start: number, end: number) => {
                    let ranges = contractsBlockNumberRanges.filter(br => br.from <= end && br.to >= start);
                    for (let idx in ranges) {
                        const range = ranges[idx];
                        this.logger.verbose(`scanClaimedRewards - Contract: ${range.address} - Processing blocks from ${start} to ${end} - Size: ${maxScanSize}`);
                        const startTime: number = new Date().getTime();

                        if (isNotEmpty(address)) {
                            const filterWhoClaimed = range.contract.filters["RewardClaimed(address,address,address,uint256,uint256)"](null, address, null);
                            const filterDataProvider = range.contract.filters["RewardClaimed(address,address,address,uint256,uint256)"](address, null, null);
                            const filterSentTo = range.contract.filters["RewardClaimed(address,address,address,uint256,uint256)"](null, null, address);
                            let eventsWhoClaimed: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterWhoClaimed, start, end);
                            let eventsDataProvider: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterDataProvider, start, end);
                            let eventsSentTo: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterSentTo, start, end);
                            results = results.concat(eventsWhoClaimed);
                            results = results.concat(eventsDataProvider);
                            results = results.concat(eventsSentTo);
                        } else {
                            const filterAll = range.contract.filters["RewardClaimed(address,address,address,uint256,uint256)"](null, null);
                            let eventsAll: FlrContractCommon.TypedEventLog<FlrContractCommon.TypedContractEvent<FlrFtsoRewardManager.RewardClaimedEvent.InputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputTuple, FlrFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterAll, start, end);
                            results = results.concat(eventsAll);

                        }
                        maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 500);
                    }
                    this.blockScanProgressListener$.next({ key: requestId, lastBlockNumber: end });
                    if (end < blockEnd) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, blockEnd));
                    }
                };

                await processBlocks(blockStart, Math.min(blockStart + maxScanSize, blockEnd));
                resolve(results);
            } catch (e) {
                // TODO da testare
                reject(new Error(`Unable to scan claimed rewards': ${e.message}`));
                //reject(e);
            }
        });
    }
    startHashSubmittedListener(): Promise<void> {
        (this.priceSubmitter as FlrContract.PriceSubmitter).on((this.priceSubmitter as FlrContract.PriceSubmitter).filters.HashSubmitted, async (
            submitter: string,
            epochId: bigint,
            hash: string,
            timestamp: bigint,
            event: any
        ) => {
            let hashSubmitted: HashSubmitted = new HashSubmitted();
            hashSubmitted.blockNumber = event.log.blockNumber;
            hashSubmitted.timestamp = Number(timestamp) * 1000;
            hashSubmitted.epochId = Number(epochId);
            hashSubmitted.submitter = submitter;
            this.hashSubmittedListener$.next(hashSubmitted);
        })

        return Promise.resolve();
    }

    async getSubmittedHashes(startBlock: number, endBlock: number): Promise<HashSubmitted[]> {
        try {
            if (endBlock == null) {
                endBlock = await this.provider.getBlockNumber();
            }
            const events: HashSubmitted[] = [];
            const job = await this._blockchainDaoQueue.add('scanSubmittedHashesProcessor', { startBlock: startBlock, endBlock: endBlock });
            const evts: HashSubmitted[] = await job.finished() as HashSubmitted[];
            events.push(...evts);
            return events;
        } catch (err) {
            throw err;
        }
    }
    @Process({ name: 'scanSubmittedHashesProcessor', concurrency: 1 })
    private async scanSubmittedHashesProcessor(job: Job<unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this._scanSubmittedHashes(job.data['startBlock'], job.data['endBlock'])
                .then(res => {
                    let results: HashSubmitted[] = [];
                    if (res.length > 0) {
                        results = res.map(evt => {
                            let hashSubmitted: HashSubmitted = new HashSubmitted();
                            hashSubmitted.blockNumber = evt.blockNumber;
                            hashSubmitted.submitter = evt.args[0];
                            hashSubmitted.epochId = Number(evt.args[1]);
                            hashSubmitted.timestamp = Number(evt.args[3]) * 1000;
                            return hashSubmitted;
                        });
                    }
                    resolve(results);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
    async _scanSubmittedHashes(blockNumberStart: number, blockNumberEnd: number): Promise<FlrContractCommon.TypedEventLog<any>[]> {
        return new Promise<FlrContractCommon.TypedEventLog<any>[]>(async (resolve, reject) => {
            try {
                let maxScanSize: number = 250;
                let results: FlrContractCommon.TypedEventLog<any>[] = [];
                let filter: any = (this.priceSubmitter as FlrContract.PriceSubmitter).filters.HashSubmitted;
                const address = await this.priceSubmitter.getAddress();
                const processBlocks = async (start: number, end: number, contract: FlrContract.PriceSubmitter, filter: any) => {
                    this.logger.verbose(`_scanSubmittedHashes - Contract: ${address} - Processing blocks from ${start} to ${end}  - Size: ${maxScanSize}`);
                    const startTime: number = new Date().getTime();
                    const hashSubmittedEvents: FlrContractCommon.TypedEventLog<any>[] = await contract.queryFilter(filter, start, end);
                    maxScanSize = this.getMaxScanSize(startTime, maxScanSize, 250);
                    results = results.concat(hashSubmittedEvents);
                    if (end < blockNumberEnd) {
                        await processBlocks(end + 1, Math.min(end + maxScanSize, blockNumberEnd), contract, filter);
                    }
                };
                await processBlocks(blockNumberStart, Math.min(blockNumberStart + maxScanSize, blockNumberEnd), this.priceSubmitter as FlrContract.PriceSubmitter, filter);
                resolve(results);
            } catch (e) {
                reject(e);
            }
        });
    }

    
}