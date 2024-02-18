import { HashSubmitted, NetworkEnum, SgbContract, SgbContractCommon, SgbFtsoRewardManager } from "@flare-base/commons";
import { InjectQueue, Processor } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NetworkConfig } from "apps/backend/src/model/app-config/network-config";
import { ServiceStatusEnum } from "apps/backend/src/service/network-dao-dispatcher/model/service-status.enum";
import { Queue } from "bull";
import { isNotEmpty } from "class-validator";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "fs";
import { FtsoManagerWrapper } from "../model/ftso-manager-wrapper";
import { BlockchainDaoImpl } from "./blockchain-dao.impl.service";

export const BLOCKCHAIN_DAO_SGB = 'BLOCKCHAIN_DAO_SGB';
export const BLOCKCHAIN_DAO_SGB_QUEUE = 'BLOCKCHAIN_DAO_SGB_QUEUE';

@Injectable()
@Processor(BLOCKCHAIN_DAO_SGB_QUEUE)
export class BlockchainDaoSgbImpl extends BlockchainDaoImpl {
    logger: Logger = new Logger(BlockchainDaoSgbImpl.name);
    constructor(private _configService: ConfigService, @InjectQueue(BLOCKCHAIN_DAO_SGB_QUEUE) _blockchainDaoQueue: Queue) {
        super();
        const networkConfig: NetworkConfig[] = this._configService.get<NetworkConfig[]>('network');
        if (networkConfig.find(nConfig => nConfig.name == NetworkEnum.songbird)) {
            this.logger.log("Initializing Blockchain DAO");
            this.status = ServiceStatusEnum.INITIALIZING;
            this._blockchainDaoQueue = _blockchainDaoQueue;
            this.config = networkConfig.find(nConfig => nConfig.name == NetworkEnum.songbird).blockchainDao;
            this.initialize().then(() => this.status = ServiceStatusEnum.STARTED).catch((err) => { throw new Error(err) });
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
                this.priceSubmitter = SgbContract.PriceSubmitter__factory.connect(this.config.priceSubmitterContractAddress, this.provider);
                this.ftsoManager = SgbContract.FtsoManager__factory.connect(await this.priceSubmitter.getFtsoManager(), this.provider);
                this.addressUpdater = SgbContract.AddressUpdater__factory.connect(await this.ftsoManager.getAddressUpdater(), this.provider);
                let contractAddressesAndNames: { _contractNames: string[]; _contractAddresses: string[]; } = await this.addressUpdater.getContractNamesAndAddresses();
                contractAddressesAndNames._contractNames.map((contractName, idx) => this.contractsList[contractName] = contractAddressesAndNames._contractAddresses[idx]);
                this.ftsoRewardManager = SgbContract.FtsoRewardManager__factory.connect(this.contractsList['FtsoRewardManager'], this.provider);
                this.ftsoManager = SgbContract.FtsoManager__factory.connect(this.contractsList['FtsoManager'], this.provider);
                this.ftsoManagerWrapper = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger);
                this.wnat = SgbContract.WNat__factory.connect(this.contractsList['WNat'], this.provider);
                this.VPContract = SgbContract.VPContract__factory.connect(await this.wnat.readVotePowerContract(), this.provider);
                this.voterWhitelister = SgbContract.VoterWhitelister__factory.connect(this.contractsList['VoterWhitelister'], this.provider);
                if (isNotEmpty(this.config.ftsoManagerWrapperPath)) {
                    try {
                        this.ftsoManagerWrapper = JSON.parse(readFileSync(this.config.ftsoManagerWrapperPath, 'utf8'));
                        this.ftsoManagerWrapper.logger = this.logger;
                        this.ftsoManagerWrapper.getContractsByBlockNumberRange = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getContractsByBlockNumberRange;
                        this.ftsoManagerWrapper.getSymbolByContractAddress = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getSymbolByContractAddress;
                        this.ftsoManagerWrapper.getSymbolByIndex = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getSymbolByIndex;
                        this.ftsoManagerWrapper.getDecimalsByContractAddress = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger).getDecimalsByContractAddress;

                    } catch (fsErr) {
                        this.ftsoManagerWrapper = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger);
                        await this.ftsoManagerWrapper.initialize();
                        writeFileSync(this.config.ftsoManagerWrapperPath, this.ftsoManagerWrapper.toString());
                    }
                } else {
                    this.ftsoManagerWrapper = new FtsoManagerWrapper(this.contractsList['FtsoManager'], this.provider, this.logger);
                    await this.ftsoManagerWrapper.initialize();
                }
                this.logger.log("Blockchain DAO initialized");
                resolve();
            } catch (e) {
                reject(new Error(`Unable to initialize smart contracts: ${e.message}`));
            }
        });
    }
    async scanClaimedRewards(blockStart: number, blockEnd: number, address: string, requestId?: string): Promise<SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[]> {
        return new Promise<SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[]>(async (resolve, reject) => {
            try {
                let results: SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = [];
                let maxScanSize: number = 100;
                let contractsBlockNumberList = [];
                const fillContractsBlockNumberList = async (contract: SgbContract.FtsoRewardManager) => {
                    const rewardManagerAddress: string = await contract.getAddress();
                    if (rewardManagerAddress != '0x0000000000000000000000000000000000000000' && rewardManagerAddress != '0xc5738334b972745067fFa666040fdeADc66Cb925') {
                        const initialRewardEpoch: number = Number(await contract.getInitialRewardEpoch());
                        const initialRewardEpochBlockNumber = (await this.getRewardEpoch(initialRewardEpoch)).blockNumber;
                        contractsBlockNumberList.push({
                            contract: contract,
                            address: rewardManagerAddress,
                            initialRewardEpochBlockNumber: initialRewardEpochBlockNumber
                        });
                        /* This RewardManager instance doesn't have  "oldFtsoRewardManager()" method, so the oldest reward manager address are hard coded here. */
                        const oldAddress: string = await contract.oldFtsoRewardManager();
                        let oldFtsoRewardManager: SgbContract.FtsoRewardManager = SgbContract.FtsoRewardManager__factory.connect(oldAddress, this.provider);
                        await fillContractsBlockNumberList(oldFtsoRewardManager);
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
                            let eventsWhoClaimed: SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterWhoClaimed, start, end);
                            let eventsDataProvider: SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterDataProvider, start, end);
                            let eventsSentTo: SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterSentTo, start, end);
                            results = results.concat(eventsWhoClaimed);
                            results = results.concat(eventsDataProvider);
                            results = results.concat(eventsSentTo);
                        } else {
                            const filterAll = range.contract.filters["RewardClaimed(address,address,address,uint256,uint256)"](null, null);
                            let eventsAll: SgbContractCommon.TypedEventLog<SgbContractCommon.TypedContractEvent<SgbFtsoRewardManager.RewardClaimedEvent.InputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputTuple, SgbFtsoRewardManager.RewardClaimedEvent.OutputObject>>[] = await range.contract.queryFilter(filterAll, start, end);
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
                reject(e);
            }
        });
    }
    startHashSubmittedListener(): Promise<void> {
        (this.priceSubmitter as SgbContract.PriceSubmitter).on((this.priceSubmitter as SgbContract.PriceSubmitter).filters.PriceHashesSubmitted, async (
            submitter: string,
            epochId: bigint,
            ftsos: string[],
            hashes: string[],
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
}