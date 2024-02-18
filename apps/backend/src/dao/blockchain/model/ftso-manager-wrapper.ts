import { FlrContract } from "@flare-base/commons";
import { Logger } from "@nestjs/common";
import { ethers } from "ethers";

/**
 * This class scan the blockchain to find all the FtsoManager contracts and their relatives Ftso contracts.
 * Since more FTSO (currencies) can be added to the FtsoManager, in order to keep an history is necessary to have a list of all FTSO addresses.
 */

export class FtsoManagerWrapper {
    logger: Logger;
    ftsoManagerAddress: string;
    provider: ethers.Provider;
    contracts: DynamicFtsoManager[] = [];


    constructor(ftsoManagerAddress: string, provider: ethers.Provider, logger: Logger) {
        this.logger = logger;
        this.ftsoManagerAddress = ftsoManagerAddress;
        this.provider = provider;
    }

    toString(): string {
        let obj: any = {};
        obj.ftsoManagerAddress = this.ftsoManagerAddress;
        obj.contracts = [];
        this.contracts.map(contract => {
            obj.contracts.push(JSON.parse(contract.toString()));
        });
        return JSON.stringify(obj);
    }

    initialize(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.logger.log(`Initializing FtsoManager wrapper...`);
            try {
                let startTime: number = new Date().getTime();
                await this.initializeContracts(this.ftsoManagerAddress);
                let scanSize = 500000;
                const maxBlock: number = await this.provider.getBlockNumber();
                // Sorting FTSOManager, asc
                this.contracts.sort((a, b) => b.ftsoManagerAddress.localeCompare(a.ftsoManagerAddress));
                let inactiveFtsoAddresses = [];
                let inactiveFtsoAddressesBlockNumbers = [];
                for (let i in this.contracts) {
                    let lastUnprocessedPriceEpochData: number = null;
                    if (parseInt(i) < this.contracts.length - 1) {
                        try {
                            lastUnprocessedPriceEpochData = Number((await this.contracts[i].ftsoManagerContract.getLastUnprocessedPriceEpochData())._lastUnprocessedPriceEpoch);
                        } catch (luedErr) {
                            // The first FtsoManager contract on Songbird Network doesn't have a "getLastUnprocessedPriceEpochData" method
                        }
                    }

                    let startBlock: number = 0;
                    this.logger.debug(`${i} - ${this.contracts[i].ftsoManagerAddress} - Finding FTSO contracts`);
                    const filter = this.contracts[i].ftsoManagerContract.filters.FtsoAdded;
                    let ftsoAddedResults: any[] = [];
                    while (true) {
                        const endBlock = startBlock + scanSize;
                        if (endBlock <= maxBlock) {
                            const ftsoAddedEvents = await this.contracts[i].ftsoManagerContract.queryFilter(filter, startBlock, endBlock);
                            startBlock = endBlock + 1;
                            if (ftsoAddedEvents.length > 0) {
                                ftsoAddedResults.push(...ftsoAddedEvents)
                            }
                        } else {
                            break;
                        }
                    }
                    if (ftsoAddedResults.length > 0) {
                        this.logger.debug(`${i} - ${this.contracts[i].ftsoManagerAddress} - FTSO contracts found. Initializing...`);
                        let ftsoMap: { [symbol: string]: { [ftsoIndex: number]: any[] } } = {};
                        let ftsoIndexes: { [symbol: string]: number } = {};
                        let ftsoIdxCounter: number = -1;
                        let lastSymbol: string = null;
                        for (let ftsoIdx in ftsoAddedResults) {
                            let tmpContract: FlrContract.FtsoOld = FlrContract.FtsoOld__factory.connect(ftsoAddedResults[ftsoIdx].args[0], this.provider);
                            const symbol = await tmpContract.symbol();
                            if (symbol != lastSymbol && typeof ftsoIndexes[symbol] == 'undefined') { ftsoIdxCounter++ }
                            if (typeof ftsoIndexes[symbol] == 'undefined') { ftsoIndexes[symbol] = ftsoIdxCounter; }
                            lastSymbol = symbol;
                        }
                        for (let ftsoIdx in ftsoAddedResults) {
                            let tmpContract: FlrContract.FtsoOld = FlrContract.FtsoOld__factory.connect(ftsoAddedResults[ftsoIdx].args[0], this.provider);
                            const symbol = await tmpContract.symbol();
                            if (typeof ftsoMap[symbol] == 'undefined' && typeof ftsoIndexes[symbol] != 'undefined') { ftsoMap[symbol] = {}; ftsoMap[symbol][ftsoIndexes[symbol]] = [] }
                            ftsoMap[symbol][ftsoIndexes[symbol]].push(ftsoAddedResults[ftsoIdx]);
                        }
                        let ftsoDeactivatedMap: { [address: string]: any } = {};
                        let ftsoOnlyActiveList: any[] = [];
                        for (let symbol of Object.keys(ftsoMap)) {
                            let ftsoIndex: number = parseInt(Object.keys(ftsoMap[symbol])[0]);
                            ftsoMap[symbol][ftsoIndex].map(f => {
                                if (!ftsoDeactivatedMap[f.args[0]]) { ftsoDeactivatedMap[f.args[0]] = {} }
                                ftsoDeactivatedMap[f.args[0]] = f;
                            });
                        }
                        for (let address in ftsoDeactivatedMap) {
                            if (ftsoDeactivatedMap[address].args[1] == true) {
                                ftsoOnlyActiveList.push(ftsoDeactivatedMap[address]);
                            }
                        }
                        for (let symbol of Object.keys(ftsoMap)) {
                            let ftsoIndex: number = parseInt(Object.keys(ftsoMap[symbol])[0]);
                            ftsoMap[symbol][ftsoIndex].sort((a, b) => a.index - b.index);
                            let foundActiveContract: any;
                            ftsoMap[symbol][ftsoIndex].map(f => {
                                if (typeof foundActiveContract == 'undefined') {
                                    foundActiveContract = ftsoOnlyActiveList.find(af => af.args[0] == f.args[0] && af.args[1] == true)
                                }
                            })
                            if (typeof foundActiveContract != 'undefined') {
                                let address: string = foundActiveContract.args[0];
                                let active: boolean = foundActiveContract.args[1];
                                let dynamicFtso: DynamicFtso = new DynamicFtso();
                                dynamicFtso.address = address;
                                dynamicFtso.activeFromBlock = (ftsoMap[symbol][ftsoIndex][0].blockNumber > 0 && ftsoMap[symbol][ftsoIndex][0].blockNumber - 1000 > 0) ? ftsoMap[symbol][ftsoIndex][0].blockNumber - 1000 : ftsoMap[symbol][ftsoIndex][0].blockNumber;
                                dynamicFtso.activeToPriceEpoch = lastUnprocessedPriceEpochData != null ? lastUnprocessedPriceEpochData : null;
                                let tmpContract: FlrContract.FtsoOld = FlrContract.FtsoOld__factory.connect(dynamicFtso.address, this.provider);
                                dynamicFtso.decimals = Number(await tmpContract.ASSET_PRICE_USD_DECIMALS.call({}));
                                dynamicFtso.active = active;
                                dynamicFtso.index = ftsoIndex;
                                dynamicFtso.symbol = symbol;
                                if (typeof this.contracts[i].ftsoContracts[dynamicFtso.symbol] == 'undefined') {
                                    this.contracts[i].ftsoContracts[dynamicFtso.symbol] = null;
                                }
                                this.contracts[i].ftsoContracts[dynamicFtso.symbol] = dynamicFtso;
                            } else {
                                let address: string = ftsoMap[symbol][ftsoIndex][0].args[0];
                                let dynamicFtso: DynamicFtso = new DynamicFtso();
                                dynamicFtso.address = address;
                                dynamicFtso.activeFromBlock = (ftsoMap[symbol][ftsoIndex][0].blockNumber > 0 && ftsoMap[symbol][ftsoIndex][0].blockNumber - 1000 > 0) ? ftsoMap[symbol][ftsoIndex][0].blockNumber - 1000 : ftsoMap[symbol][ftsoIndex][0].blockNumber;
                                dynamicFtso.activeToPriceEpoch = lastUnprocessedPriceEpochData != null ? lastUnprocessedPriceEpochData : null;
                                let tmpContract: FlrContract.FtsoOld = FlrContract.FtsoOld__factory.connect(dynamicFtso.address, this.provider);
                                dynamicFtso.decimals = Number(await tmpContract.ASSET_PRICE_USD_DECIMALS.call({}));
                                dynamicFtso.active = false;
                                dynamicFtso.index = ftsoIndex;
                                dynamicFtso.symbol = symbol;
                                if (typeof this.contracts[i].ftsoContracts[dynamicFtso.symbol] == 'undefined') {
                                    this.contracts[i].ftsoContracts[dynamicFtso.symbol] = null;
                                }
                                this.contracts[i].ftsoContracts[dynamicFtso.symbol] = dynamicFtso;
                            }
                        }

                        this.logger.debug(`${i} - ${this.contracts[i].ftsoManagerAddress} - FTSO contracts initialized.`);
                    }
                }
                // Finding first epochs
                scanSize = 10000;
                for (let idx in this.contracts) {
                    for (let symbol in this.contracts[idx].ftsoContracts) {
                        if (typeof this.contracts[idx].ftsoContracts[symbol] != 'undefined') {
                            this.logger.debug(`${idx} - ${symbol} - ${this.contracts[idx].ftsoContracts[symbol].address} - Finding FTSO first priceEpoch`);
                            let startBlock: number = 0;
                            let counter: number = 0;
                            let oldFtsoFound: boolean = false;

                            // Do the scan with the old Ftso Contract
                            let oldContract: FlrContract.FtsoOld = FlrContract.FtsoOld__factory.connect(this.contracts[idx].ftsoContracts[symbol].address, this.provider);
                            let oldContractFilter = oldContract.filters.PriceFinalized();
                            startBlock = this.contracts[idx].ftsoContracts[symbol].activeFromBlock;
                            while (true) {
                                const endBlock = startBlock + scanSize;
                                if (endBlock <= maxBlock && counter < 3) {
                                    this.logger.verbose(`${idx} - ${symbol} - oldContract - ${this.contracts[idx].ftsoContracts[symbol].address} - Scanning from ${startBlock} to ${endBlock} `);
                                    const priceFinalizedEvents = await oldContract.queryFilter(oldContractFilter, startBlock, endBlock);
                                    startBlock = endBlock + 1;
                                    if (priceFinalizedEvents.length > 0) {
                                        this.contracts[idx].ftsoContracts[symbol].activeFromPriceEpoch = Number(priceFinalizedEvents[0].args[0]);
                                        this.contracts[idx].ftsoContracts[symbol].hasElasticBand = false;
                                        oldFtsoFound = true;
                                        this.logger.debug(`${idx} - ${symbol} - oldContract - ${this.contracts[idx].ftsoContracts[symbol].address} - Found priceEpoch on new Ftso contract`);
                                        break;
                                    }
                                    counter++;
                                } else {
                                    break;
                                } 
                            }
                            // Do the scan with the new Ftso Contract
                            if (!oldFtsoFound) {
                                startBlock = this.contracts[idx].ftsoContracts[symbol].activeFromBlock;
                                counter = 0;
                                let newContract: FlrContract.Ftso = FlrContract.Ftso__factory.connect(this.contracts[idx].ftsoContracts[symbol].address, this.provider);
                                let newContractFilter = newContract.filters.PriceFinalized();

                                while (true) {
                                    const endBlock = startBlock + scanSize;
                                    if (endBlock <= maxBlock && counter < 3) {
                                        this.logger.verbose(`${idx} - ${symbol} - newContract - ${this.contracts[idx].ftsoContracts[symbol].address} - Scanning from ${startBlock} to ${endBlock} `);
                                        const priceFinalizedEvents = await newContract.queryFilter(newContractFilter, startBlock, endBlock);
                                        startBlock = endBlock + 1;
                                        if (priceFinalizedEvents.length > 0) {
                                            this.contracts[idx].ftsoContracts[symbol].activeFromPriceEpoch = Number(priceFinalizedEvents[0].args[0]);
                                            this.contracts[idx].ftsoContracts[symbol].hasElasticBand = true;
                                            this.logger.debug(`${idx} - ${symbol} - newContract - ${this.contracts[idx].ftsoContracts[symbol].address} - Found priceEpoch on new Ftso contract`);
                                            break;
                                        }
                                        counter++;
                                    } else {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                this.contracts.map(async (dc, dcIdx) => {
                    for (let symbol in dc.ftsoContracts) {
                        if (typeof dc.ftsoContracts != 'undefined') {
                            if (this.contracts[dcIdx + 1] && typeof this.contracts[dcIdx + 1].ftsoContracts[symbol] != 'undefined') {
                                dc.ftsoContracts[symbol].activeToBlock = (this.contracts[dcIdx + 1].ftsoContracts[symbol].activeFromBlock - 1) + 20000;
                            }

                            if (this.contracts[dcIdx - 1] && typeof this.contracts[dcIdx - 1].ftsoContracts[symbol] != 'undefined') {
                                dc.ftsoContracts[symbol].activeFromPriceEpoch = this.contracts[dcIdx - 1].ftsoContracts[symbol].activeToPriceEpoch + 1;
                            }

                            if (this.contracts[dcIdx + 1] && typeof this.contracts[dcIdx + 1].ftsoContracts[symbol] != 'undefined') {
                                dc.ftsoContracts[symbol].activeToPriceEpoch = (this.contracts[dcIdx + 1].ftsoContracts[symbol].activeFromPriceEpoch - 1);
                            }
                        }
                    }
                });


                this.logger.log(`FtsoManager wrapper initialized.`);
                this.logger.log(`Duration: ${(new Date().getTime() - startTime) / 1000} s`)
                resolve();
            } catch (err) {
                reject(new Error(`Unable to initialize FtsoManagerWrapper: ${err.message}`));
            }
        });
    }

    initializeContracts = async (ftsoManagerAddress: string) => {
        try {
            const ftsoManagerContract: FlrContract.FtsoManager = FlrContract.FtsoManager__factory.connect(ftsoManagerAddress, this.provider);
            const ftsoRegistryContract: FlrContract.FtsoRegistry = FlrContract.FtsoRegistry__factory.connect(await ftsoManagerContract.ftsoRegistry(), this.provider);
            let dftsoManager: DynamicFtsoManager = new DynamicFtsoManager(ftsoManagerContract, ftsoRegistryContract);
            dftsoManager.ftsoManagerAddress = await ftsoManagerContract.getAddress();
            this.contracts.push(dftsoManager);
            const oldFtsoManagerAddress: string = await ftsoManagerContract.oldFtsoManager();
            if (oldFtsoManagerAddress != '0x0000000000000000000000000000000000000000') {
                await this.initializeContracts(oldFtsoManagerAddress);
            }
        } catch (e) {
            // The first FtsoManager contract on Songbird Network doesn't have a "oldFtsoManager" method
        }
    }
    getContractsByBlockNumberRange(blockNumberStart: number, blockNumberEnd: number): { [symbol: string]: DynamicFtso[] } {
        let filteredFtsoContracts: { [symbol: string]: DynamicFtso[] } = {};
        this.contracts.map(ftsoManager => {
            for (const dynamicFtso of Object.values(ftsoManager.ftsoContracts)) {
                if (
                    ((dynamicFtso.activeToBlock === null || dynamicFtso.activeToBlock >= blockNumberStart) &&
                        dynamicFtso.activeFromBlock <= blockNumberEnd)
                ) {
                    if (typeof filteredFtsoContracts[dynamicFtso.symbol] == 'undefined') {
                        filteredFtsoContracts[dynamicFtso.symbol] = [];
                    }
                    filteredFtsoContracts[dynamicFtso.symbol].push(dynamicFtso);
                }
            }
        })

        return filteredFtsoContracts;
    }
    getSymbolByContractAddress(address: string): string {
        let symbol: string = null;
        this.contracts.map(ftsoManager => {
            for (const dynamicFtso of Object.values(ftsoManager.ftsoContracts)) {
                if (dynamicFtso.address.toLowerCase() == address.toLowerCase()) {
                    symbol = dynamicFtso.symbol;
                }
            }
        })
        return symbol;
    }
    getSymbolByIndex(index: number): string {
        let symbol: string = null;
        this.contracts.map(ftsoManager => {
            for (const dynamicFtso of Object.values(ftsoManager.ftsoContracts)) {
                if (dynamicFtso.index == index) {
                    symbol = dynamicFtso.symbol;
                }
            }
        })
        return symbol;
    }
    getDecimalsByContractAddress(address: string): number {
        let decimals: number = 5;
        this.contracts.map(ftsoManager => {
            for (const dynamicFtso of Object.values(ftsoManager.ftsoContracts)) {
                if (dynamicFtso.address.toLowerCase() == address.toLowerCase()) {
                    decimals = dynamicFtso.decimals;
                }
            }
        })
        return decimals;
    }
}




export class DynamicFtsoManager {
    ftsoManagerContract: FlrContract.FtsoManager;
    ftsoRegistryContract: FlrContract.FtsoRegistry;
    ftsoManagerAddress: string;
    ftsoRegistryAddress: string;
    ftsoContracts: { [symbol: string]: DynamicFtso } = {};

    public toString(): string {
        let obj: any = {};
        obj.ftsoManagerContract = null;
        obj.ftsoRegistryContract = null;
        obj.ftsoManagerAddress = this.ftsoManagerAddress
        obj.ftsoRegistryAddress = this.ftsoRegistryAddress
        obj.ftsoContracts = this.ftsoContracts
        return JSON.stringify(obj);
    }
    constructor(ftsoManagerContract: FlrContract.FtsoManager, ftsoRegistryContract: FlrContract.FtsoRegistry) {
        this.ftsoManagerContract = ftsoManagerContract;
        this.ftsoRegistryContract = ftsoRegistryContract;
    }


    getContractsByBlockNumberRange(startBlock: number, endBlock: number): DynamicFtso[] {
        const result: DynamicFtso[] = [];
        for (const dynamicFtso of Object.values(this.ftsoContracts)) {
            if (
                (dynamicFtso.activeToBlock === null || dynamicFtso.activeToBlock >= startBlock) &&
                dynamicFtso.activeFromBlock <= endBlock
            ) {
                result.push(dynamicFtso);
            }
        }
        return result;
    }
}



export class DynamicFtso {
    symbol: string;
    decimals: number;
    address: string;
    active: boolean;
    index: number;
    hasElasticBand: boolean;
    activeFromBlock: number = null;
    activeToBlock: number = null;
    activeFromPriceEpoch: number = null;
    activeToPriceEpoch: number = null;
}