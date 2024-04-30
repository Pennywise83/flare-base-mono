import { EventEmitter, Injectable, Output } from '@angular/core';
import detectEthereumProvider from '@metamask/detect-provider';
import { WalletBalance } from 'app/modules/wallet/wallet-balance/model/wallet-balance';
import { DelegatesOf } from 'app/modules/wallet/wallet-delegations/model/delegates-of';
import { DelegatesOfRequest } from 'app/modules/wallet/wallet-delegations/model/delegates-of-request';
import { isEmpty, isNotEmpty } from 'class-validator';
import { BigNumberish, ethers } from 'ethers';
import { Observable, firstValueFrom } from 'rxjs';
import { FlrContract, NetworkEnum, RewardEpochSettings, SgbContract } from '../../../../../../libs/commons/src';
import { UnclaimedReward } from '../../../../../../libs/commons/src/model/rewards/reward';
import { availableChains } from './model/available-chains';
import { IChainDefinition } from './model/i-chain-definition';
import { TransactionOperationEnum } from './model/transaction-operation.enum';
import { Web3LoadingType, Web3LoadingTypeEnum } from './model/web3-loading-type';
import { Web3ClientMessage } from './model/web3client-message';
import { RewardDistributorFactory__factory } from '../../../../../../libs/commons/src/contracts/types/sgb';
import { RewardDistributorFactory } from '../../../../../../libs/commons/src/contracts/types/flr';
import { RewardDistributorNamedInstance } from './model/reward-distributor-named-instance';
import { IRewardDistributorFactory } from '../../../../../../libs/commons/src/contracts/types/sgb/RewardDistributorFactory';
import { ClaimRewardsRequest } from 'app/modules/wallet/wallet-claimed-rewards/model/claim-rewards-request';
declare const window: any;
const { ethereum } = window;
@Injectable({
    providedIn: 'root'
})
export class Web3Service {

    private _provider: ethers.BrowserProvider = null;
    private _signer: Promise<ethers.JsonRpcSigner>;
    private _address: string;
    private _selectedChain: number;
    @Output() chainIdChanged$: EventEmitter<any> = new EventEmitter();
    @Output() smartContractsInitialized$: EventEmitter<any> = new EventEmitter();
    @Output() addressChanged$: EventEmitter<string> = new EventEmitter();
    @Output() balancesChanged$: EventEmitter<WalletBalance> = new EventEmitter();
    @Output() delegatesOfChanged$: EventEmitter<Map<number, DelegatesOf>> = new EventEmitter();
    @Output() unclaimedRewardsChanged$: EventEmitter<UnclaimedReward[]> = new EventEmitter();
    @Output() rewardDistributorNamedInstancesChange$: EventEmitter<RewardDistributorNamedInstance[]> = new EventEmitter();
    @Output() clientConnected$: EventEmitter<boolean> = new EventEmitter();
    @Output() loading$: EventEmitter<Web3LoadingType> = new EventEmitter();
    private _priceSubmitterContract: FlrContract.PriceSubmitter | SgbContract.PriceSubmitter;
    private _ftsoManagerContract: FlrContract.FtsoManager | SgbContract.FtsoManager;
    private _ftsoRegistryContract: FlrContract.FtsoRegistry | SgbContract.FtsoRegistry;
    private _ftsoRewardsManagerContract: FlrContract.FtsoRewardManager | SgbContract.FtsoRewardManager;
    private _wnatContract: FlrContract.WNat | SgbContract.WNat;
    private _clientConnected: boolean = false;
    private _isContractsInitialized: boolean = false;
    private _walletBalance: WalletBalance = new WalletBalance();
    private _delegatesOf: Map<number, DelegatesOf>;
    private _rewardDistributorNamedInstances: RewardDistributorNamedInstance[];
    private _unclaimedRewards: UnclaimedReward[];
    private _hasBatchDelegate: boolean = false;
    private _rewardEpochSettings: RewardEpochSettings;
    private _rewardDistributorFactory: RewardDistributorFactory;

    constructor() {


    }
    public checkMetamaskProvider(): Observable<boolean> {
        return new Observable<boolean>(observer => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, true));
            detectEthereumProvider().then(async provider => {
                if (provider && typeof (provider as any).isMetaMask != 'undefined') {
                    this._provider = new ethers.BrowserProvider(window.ethereum);
                    this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                    observer.next(true);
                    this._subscribeToContractsInitializedEvent();
                    this.subscribeToAccountChangedEvent();
                    this.subscribeToChainChangedEvent();
                    this._subscribeToClientConnectedEvent();
                    
                    observer.complete();
                } else {
                    observer.next(false);
                }

            });
        });
    }
    public checkIfIsConnected(): Observable<boolean> {
        return new Observable<boolean>(observer => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, true));
            ethereum.request({ method: 'eth_accounts' }).then(async (res) => {
                if (res.length > 0) {
                    await firstValueFrom(this.initializeSmartContract());
                    this._address = res[0];
                }
                this.addressChanged$.emit(this._address);
                if (window.ethereum.networkVersion) {
                    this.chainIdChanged$.next(window.ethereum.networkVersion);
                }
                this.clientConnected$.next(true);
                observer.next(true);
                observer.complete();
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
            }).catch(err => {
                this._address = null;
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                observer.error(new Error(err.message));
                observer.complete();
            });
        });
    }

    private _switchChain(chainDefinition: IChainDefinition): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, true));
            if (window.ethereum.networkVersion !== chainDefinition.chainId.toString()) {
                window.ethereum.request({
                    method: "wallet_switchEthereumChain",
                    params: [{
                        chainId: `0x${Number(chainDefinition.chainId).toString(16)}`,
                    }]
                }).then(switchChainRes => {
                    this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                    this.chainIdChanged$.next(chainDefinition.chainId);
                    resolve(true);
                }).catch(err => {
                    if (err.code == 4902) {
                        this._addChain(chainDefinition).then(chainAddRes => {
                            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                            resolve(this._switchChain(chainDefinition));
                        }, chainAddErr => {
                            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                            reject(chainAddErr);
                        })
                    } else if (err.code == 4001) {
                        this.chainIdChanged$.next(null);
                        this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                        reject(`Cannot switch to ${chainDefinition.chainName} chain: ${err.message}`);
                    } else {
                        this.chainIdChanged$.next(null);
                        this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                        reject(`Cannot switch to ${chainDefinition.chainName} chain: ${err.message}`);
                    }

                    return;
                });
            } else {
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                this.chainIdChanged$.next(chainDefinition.chainId);
                resolve(true);
            }
        });
    }

    private _addChain(chainDefinition: IChainDefinition): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, true));
            window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainName: chainDefinition.chainName,
                    chainId: `0x${Number(chainDefinition.chainId).toString(16)}`,
                    rpcUrls: chainDefinition.rpcUrls,
                    nativeCurrency: chainDefinition.nativeCurrency,
                    blockExplorerUrls: chainDefinition.blockExplorerUrls
                }]
            }).then(res => {
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                resolve(true);
                return;
            }).catch(err => {
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                reject(`Cannot add ${chainDefinition.chainName} to Web3 Client: ${err.message}`);
                return;
            });
        });
    }

    public connectWeb3Client(network: NetworkEnum): Observable<boolean> {
        return new Observable<boolean>(observer => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
            const selectedChain: IChainDefinition = availableChains.find(chain => chain.network == network);
            this._switchChain(selectedChain).then(switchChainRes => {
                this._provider = new ethers.BrowserProvider(window.ethereum);
                this._provider.send("eth_requestAccounts", []).then(async (accounts) => {
                    await firstValueFrom(this.initializeSmartContract());
                    this.clientConnected$.emit(true);
                    this.addressChanged$.emit(accounts[0]);
                    this.chainIdChanged$.emit(this._selectedChain);
                    this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                    observer.next(true);
                    observer.complete();
                }).catch(err => {
                    this.clientConnected$.emit(false);
                    this.addressChanged$.emit(null);
                    this.chainIdChanged$.emit(null);
                    observer.error(new Error(`Unable to connect Web3 Client: ${err.message}`));
                    observer.complete();
                });
            }).catch(switchChainErr => {
                this.clientConnected$.emit(false);
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
                observer.error(new Error(switchChainErr));
                observer.complete();
            });
        });
    }

    private _subscribeToClientConnectedEvent(): void {
        this.clientConnected$.subscribe(clientConnected => {
            this._clientConnected = clientConnected;
        })
    }
    private _subscribeToContractsInitializedEvent(): void {
        this.smartContractsInitialized$.subscribe(contractsInitialized => {
            this._isContractsInitialized = contractsInitialized;
        })
    }
    public isClientConnected(): boolean {
        return this._clientConnected;
    }
    public getConnectedChain(): number {
        return this._selectedChain;
    }
    public getConnectedAddress(): string {
        return this._address;
    }
    public isContractsInitialized(): boolean {
        return this._isContractsInitialized;
    }

    private subscribeToAccountChangedEvent(): void {
        window.ethereum.on('accountsChanged', async (accounts: any) => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, true));
            if (accounts.length == 0) {
                this._address = null;
                this.addressChanged$.next(null);
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
            } else {
                this._address = accounts[0];
                this.addressChanged$.emit(accounts[0]);
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.GLOBAL, false));
            }
        });
    }
    subscribeToChainChangedEvent() {
        window.ethereum.on('chainChanged', async (chainId: number) => {
            this._selectedChain = chainId;
            this.chainIdChanged$.emit(this._selectedChain);
        });
    }

    public initializeSmartContract(): Observable<boolean> {
        return new Observable<boolean>(observer => {
            this._provider.getNetwork().then(async (network) => {
                const selectedChain: IChainDefinition = availableChains.find(chain => chain.chainId == Number(network.chainId));
                this._selectedChain = selectedChain.chainId;
                try {
                    this._signer = this._provider.getSigner();
                    switch (selectedChain.network) {
                        case NetworkEnum.flare:
                            this._priceSubmitterContract = await FlrContract.PriceSubmitter__factory.connect(selectedChain.priceSubmitterContract, this._provider);
                            this._ftsoManagerContract = FlrContract.FtsoManager__factory.connect(await this._priceSubmitterContract.getFtsoManager(), this._provider);
                            this._ftsoRegistryContract = FlrContract.FtsoRegistry__factory.connect(await this._priceSubmitterContract.getFtsoRegistry(), this._provider);
                            this._ftsoRewardsManagerContract = FlrContract.FtsoRewardManager__factory.connect(await this._ftsoManagerContract.rewardManager(), await this._signer);
                            this._wnatContract = FlrContract.WNat__factory.connect(await this._ftsoRewardsManagerContract.wNat(), await this._signer);
                            this._rewardDistributorFactory = RewardDistributorFactory__factory.connect(selectedChain.rewardDistributorContractAddress, await this._signer);
                            this._hasBatchDelegate = true;
                            break;
                        case NetworkEnum.songbird:
                            this._priceSubmitterContract = await SgbContract.PriceSubmitter__factory.connect(selectedChain.priceSubmitterContract, this._provider);
                            this._ftsoManagerContract = SgbContract.FtsoManager__factory.connect(await this._priceSubmitterContract.getFtsoManager(), this._provider);
                            this._ftsoRegistryContract = SgbContract.FtsoRegistry__factory.connect(await this._priceSubmitterContract.getFtsoRegistry(), this._provider);
                            this._ftsoRewardsManagerContract = SgbContract.FtsoRewardManager__factory.connect(await this._ftsoManagerContract.rewardManager(), await this._signer);
                            this._wnatContract = SgbContract.WNat__factory.connect(await this._ftsoRewardsManagerContract.wNat(), await this._signer);
                            this._rewardDistributorFactory = RewardDistributorFactory__factory.connect(selectedChain.rewardDistributorContractAddress, await this._signer);
                            this._hasBatchDelegate = false;
                            break;
                    }
                    this.smartContractsInitialized$.next(true);
                    this._rewardEpochSettings = await this._getRewardEpochSettings();
                    observer.next(true);
                    observer.complete();
                } catch (e) {
                    this.smartContractsInitialized$.next(false);
                    observer.error(`Unable to initialize Smart Contracts`);
                    observer.complete();
                }
                if (this._selectedChain == null) {
                    this.smartContractsInitialized$.next(false);
                    observer.next(null);
                    observer.complete();
                }
            }).catch(networkError => {
                this.smartContractsInitialized$.next(false);
                observer.error(`${networkError.message}`);
                observer.complete();
            });
        });
    }

    public hasBatchDelegate(): boolean {
        return this._hasBatchDelegate;
    }

    public getBalances(): WalletBalance {
        if (isEmpty(this._walletBalance)) {
            this._walletBalance = new WalletBalance([0, 0]);
        }
        return this._walletBalance;
    }
    public fetchBalances(address: string): Observable<WalletBalance> {
        return new Observable<WalletBalance>(observer => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.BALANCES, true));
            this._provider.getBalance(address).then(nativeBalance => {
                this._wnatContract.balanceOf(address).then(wrappedBalance => {
                    let balances: number[] = [parseFloat(ethers.formatEther(nativeBalance)), parseFloat(ethers.formatEther(wrappedBalance))];
                    this._walletBalance = new WalletBalance(balances);
                    observer.next(this._walletBalance);
                    this.balancesChanged$.next(this._walletBalance)
                }).catch(err => {
                    observer.error(`Unable to fetch balances: ${err}`);
                }).finally(() => {
                    this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.BALANCES, false));
                    observer.complete();
                });
            });
        });
    }

    public getDelegatesOf(): Map<number, DelegatesOf> {
        if (isEmpty(this._delegatesOf)) {
            this._delegatesOf = new Map<number, DelegatesOf>();
            this._delegatesOf.set(0, new DelegatesOf('', 0));
            this._delegatesOf.set(1, new DelegatesOf('', 0));
        }
        return this._delegatesOf;
    }


    public delegate(delegateRequest: DelegatesOfRequest): Observable<Web3ClientMessage> {
        return new Observable<Web3ClientMessage>(observer => {
            let txMessage: Web3ClientMessage = new Web3ClientMessage();
            this._wnatContract.delegate(delegateRequest.address, BigInt(Math.round(delegateRequest.percentage * 100))).then(res => {
                txMessage = new Web3ClientMessage(TransactionOperationEnum.transacting);
                observer.next(txMessage);
                res.wait().then((txResponse) => {
                    txMessage = new Web3ClientMessage(TransactionOperationEnum.confirmed);
                    if (txResponse && txResponse.hash) {
                        txMessage.txId = txResponse.hash;
                    }
                    observer.next(txMessage);
                }).catch(waitErr => {
                    observer.next(this.parseError(waitErr));
                }).finally(() => {
                    observer.complete();
                })
            }).catch(err => {
                observer.next(this.parseError(err));
                observer.complete();
            });
        });
    }
    batchDelegate(delegations: Map<number, DelegatesOf>): Observable<Web3ClientMessage> {
        return new Observable<Web3ClientMessage>(observer => {
            try {
                let txMessage: Web3ClientMessage = new Web3ClientMessage();
                this._signer = this._provider.getSigner();
                let addresses: string[] = [];
                let bips: BigNumberish[] = [];
                delegations.forEach((delegateRequest, slot) => {
                    if (delegateRequest.address != '') {
                        addresses.push(delegateRequest.address);
                        bips.push(BigInt(Math.round(delegateRequest.percentage * 100)))
                    }
                });
                (this._wnatContract as FlrContract.WNat).batchDelegate(addresses, bips).then(res => {
                    txMessage = new Web3ClientMessage(TransactionOperationEnum.transacting);
                    observer.next(txMessage);
                    res.wait().then((txResponse) => {
                        txMessage = new Web3ClientMessage(TransactionOperationEnum.confirmed);
                        if (txResponse && txResponse.hash) {
                            txMessage.txId = txResponse.hash;
                        }
                        observer.next(txMessage)
                    }).catch(waitErr => {
                        observer.next(this.parseError(waitErr));
                    }).finally(() => {
                        observer.complete();
                    });
                }).catch(err => {
                    observer.next(this.parseError(err));
                    observer.complete();
                });
            } catch (err) {
                observer.next(this.parseError(err));
                observer.complete();
            }
        });
    }

    public claimRewards(owner: string, claimRewardsRequest: ClaimRewardsRequest): Observable<Web3ClientMessage> {
        return new Observable<Web3ClientMessage>(observer => {
            let txMessage: Web3ClientMessage = new Web3ClientMessage();
            let rewardEpoch: bigint = BigInt(Math.max(...claimRewardsRequest.rewardEpochIds));
            this._ftsoRewardsManagerContract.claim(owner, claimRewardsRequest.receiver, rewardEpoch, claimRewardsRequest.wrap).then(res => {
                txMessage = new Web3ClientMessage(TransactionOperationEnum.transacting);
                observer.next(txMessage);
                res.wait().then((txResponse) => {
                    txMessage = new Web3ClientMessage(TransactionOperationEnum.confirmed);
                    if (txResponse && txResponse.hash) {
                        txMessage.txId = txResponse.hash;
                    }
                    observer.next(txMessage);
                }).catch(waitErr => {
                    observer.next(this.parseError(waitErr));
                }).finally(() => {
                    observer.complete();
                })
            }).catch(err => {
                observer.next(this.parseError(err));
                observer.complete();
            });
        });
    }
    public fetchDelegatesOf(address: string): Observable<Map<number, DelegatesOf>> {
        return new Observable<Map<number, DelegatesOf>>(observer => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.DELEGATIONS, true));
            this._delegatesOf = new Map<number, DelegatesOf>();
            this._delegatesOf.set(0, new DelegatesOfRequest('', 0, 0, false));
            this._delegatesOf.set(1, new DelegatesOfRequest('', 0, 0, false));
            this._wnatContract.delegatesOf(address).then(delegations => {
                delegations._delegateAddresses.map((address, idx) => {
                    this._delegatesOf.set(idx, new DelegatesOf(address, Number(delegations._bips[idx])));
                });
                observer.next(this._delegatesOf);
                this.delegatesOfChanged$.next(this._delegatesOf);
            }).catch(err => {
                observer.error(`Unable to fetch delegations info: ${err}`);
            }).finally(() => {
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.DELEGATIONS, false));
                observer.complete();
            });;
        });
    }


    unwrap(amount: number): Observable<Web3ClientMessage> {
        return new Observable<Web3ClientMessage>(observer => {
            let txMessage: Web3ClientMessage = new Web3ClientMessage();
            this._signer = this._provider.getSigner();
            this._wnatContract.withdraw(ethers.parseUnits(amount.toString())).then(res => {
                txMessage = new Web3ClientMessage(TransactionOperationEnum.transacting);
                observer.next(txMessage);
                res.wait().then((txResponse) => {
                    txMessage = new Web3ClientMessage(TransactionOperationEnum.confirmed);
                    if (txResponse && txResponse.hash) {
                        txMessage.txId = txResponse.hash;
                    }
                    observer.next(txMessage)
                }).catch(waitErr => {
                    observer.next(this.parseError(waitErr));
                }).finally(() => {
                    observer.complete();
                });
            }).catch(err => {
                observer.next(this.parseError(err));
                observer.complete();
            });
        });
    }

    wrap(amount: number): Observable<Web3ClientMessage> {
        return new Observable<Web3ClientMessage>(observer => {
            let txMessage: Web3ClientMessage = new Web3ClientMessage();
            this._signer = this._provider.getSigner();
            const overrides = {
                value: ethers.parseUnits(amount.toString())
            }
            this._wnatContract.deposit(overrides).then(res => {
                txMessage = new Web3ClientMessage(TransactionOperationEnum.transacting);
                observer.next(txMessage);
                res.wait().then((txResponse) => {
                    txMessage = new Web3ClientMessage(TransactionOperationEnum.confirmed);
                    if (txResponse && txResponse.hash) {
                        txMessage.txId = txResponse.hash;
                    }
                    observer.next(txMessage)
                }).catch(waitErr => {
                    observer.next(this.parseError(waitErr));
                }).finally(() => {
                    observer.complete();
                });
            }).catch(err => {
                observer.next(this.parseError(err));
                observer.complete();
            });
        });
    }


    public getUnclaimedRewards(): UnclaimedReward[] {
        return this._unclaimedRewards;
    }

    private async _getRewardEpochSettings(): Promise<RewardEpochSettings> {
        let rewardEpochSettingsData: RewardEpochSettings = new RewardEpochSettings();
        rewardEpochSettingsData.firstEpochStartTime = Number(await this._ftsoManagerContract.rewardEpochsStartTs()) * 1000;
        rewardEpochSettingsData.rewardEpochDurationMillis = Number(await this._ftsoManagerContract.rewardEpochDurationSeconds()) * 1000;
        return rewardEpochSettingsData;
    }
    fetchUnclaimedRewards(address: string): Observable<UnclaimedReward[]> {
        return new Observable<UnclaimedReward[]>(observer => {
            this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.UNCLAIMED_REWARDS, true));
            let result: UnclaimedReward[] = [];
            let rewardEpochs: number[] = [this._rewardEpochSettings.getCurrentEpochId()];

            this._ftsoRewardsManagerContract.getEpochsWithUnclaimedRewards(address).then(async epochsWithUnclaimedRewards => {
                if (epochsWithUnclaimedRewards.length > 0) {
                    epochsWithUnclaimedRewards.map(epoch => rewardEpochs.push(Number(epoch)));
                }
                for (let i in rewardEpochs) {
                    const epochId: number = rewardEpochs[i];
                    let stateOfRewardResult: {
                        _dataProviders: string[];
                        _rewardAmounts: bigint[];
                        _claimed: boolean[];
                        _claimable: boolean;
                    } = await this._ftsoRewardsManagerContract.getStateOfRewards(address, epochId);
                    for (let idx in stateOfRewardResult._dataProviders) {
                        let unclaimedReward = new UnclaimedReward();
                        unclaimedReward.rewardEpochId = Number(epochId);
                        unclaimedReward.amount = Number(ethers.formatEther((stateOfRewardResult._rewardAmounts[idx])));
                        unclaimedReward.dataProvider = stateOfRewardResult._dataProviders[idx].toLowerCase();
                        unclaimedReward.whoClaimed = address.toLowerCase();
                        unclaimedReward.claimable = stateOfRewardResult._claimable;
                        unclaimedReward.claimed = stateOfRewardResult._claimed[idx];
                        result.push(unclaimedReward);
                    }
                }
                this._unclaimedRewards = result;
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.UNCLAIMED_REWARDS, false));
                this.unclaimedRewardsChanged$.next(result);
                observer.next(result);
                observer.complete();
            }, epochError => {
                this.loading$.next(new Web3LoadingType(Web3LoadingTypeEnum.UNCLAIMED_REWARDS, false));
                observer.error(`Unable to fetch epochs with unclaimed rewards: ${epochError}`);
                observer.complete();
            });
        });
    }

    public getRewardDistributorNamedInstances(): RewardDistributorNamedInstance[] {
        return this._rewardDistributorNamedInstances;
    }

    public fetchRewardDistributorNamedInstances(address: string): Observable<RewardDistributorNamedInstance[]> {
        return new Observable<Array<RewardDistributorNamedInstance>>(observer => {
            this._rewardDistributorFactory.getAll(address).then((res: IRewardDistributorFactory.NamedInstanceStructOutput[]) => {
                let namedInstances: Array<RewardDistributorNamedInstance> = [];
                res.map(async ni => {
                    namedInstances.push(new RewardDistributorNamedInstance(ni.instance, ni.description));
                });
                this._rewardDistributorNamedInstances = namedInstances;
                this.rewardDistributorNamedInstancesChange$.next(namedInstances)
                observer.next(namedInstances);
            }).catch(err => {
                observer.error(err);
            }).finally(() => {
                observer.complete();
            })
        });
    }



    private parseError(err: any): Web3ClientMessage {
        let txMessage: Web3ClientMessage = new Web3ClientMessage();
        if (err.code && err.code == 4001) {
            txMessage.operation = TransactionOperationEnum.cancelled;
            txMessage.message = 'Transaction was cancelled';
        } if (err.code && err.code == 'ACTION_REJECTED') {
            txMessage.operation = TransactionOperationEnum.cancelled;
            txMessage.message = 'Transaction was cancelled';
        } else if (err && err.data && err.data.message) {
            txMessage.operation = TransactionOperationEnum.failed;
            txMessage.message = err.data.message;
        } else if (err && err.reason) {
            txMessage.operation = TransactionOperationEnum.failed;
            txMessage.message = err.reason;
        } else {
            txMessage.operation = TransactionOperationEnum.failed;
            txMessage.message = err.message;
        }
        if (err && err.transactionHash) {
            txMessage.txId = err.transactionHash;
        }
        return txMessage;
    }
}