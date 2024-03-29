/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  EventFragment,
  AddressLike,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedLogDescription,
  TypedListener,
  TypedContractMethod,
} from "./common";

export interface PriceSubmitterInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "claimGovernance"
      | "getFtsoManager"
      | "getFtsoRegistry"
      | "getTrustedAddresses"
      | "getVoterWhitelister"
      | "governance"
      | "initialise"
      | "initialiseFixedAddress"
      | "proposeGovernance"
      | "proposedGovernance"
      | "revealPrices"
      | "setContractAddresses"
      | "setTrustedAddresses"
      | "submitPriceHashes"
      | "transferGovernance"
      | "voterWhitelistBitmap"
      | "voterWhitelisted"
      | "votersRemovedFromWhitelist"
  ): FunctionFragment;

  getEvent(
    nameOrSignatureOrTopic:
      | "GovernanceProposed"
      | "GovernanceUpdated"
      | "PriceHashesSubmitted"
      | "PricesRevealed"
  ): EventFragment;

  encodeFunctionData(
    functionFragment: "claimGovernance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getFtsoManager",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getFtsoRegistry",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getTrustedAddresses",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getVoterWhitelister",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "governance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "initialise",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "initialiseFixedAddress",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "proposeGovernance",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "proposedGovernance",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "revealPrices",
    values: [BigNumberish, BigNumberish[], BigNumberish[], BigNumberish[]]
  ): string;
  encodeFunctionData(
    functionFragment: "setContractAddresses",
    values: [AddressLike, AddressLike, AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "setTrustedAddresses",
    values: [AddressLike[]]
  ): string;
  encodeFunctionData(
    functionFragment: "submitPriceHashes",
    values: [BigNumberish, BigNumberish[], BytesLike[]]
  ): string;
  encodeFunctionData(
    functionFragment: "transferGovernance",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "voterWhitelistBitmap",
    values: [AddressLike]
  ): string;
  encodeFunctionData(
    functionFragment: "voterWhitelisted",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "votersRemovedFromWhitelist",
    values: [AddressLike[], BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "claimGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getFtsoManager",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getFtsoRegistry",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getTrustedAddresses",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getVoterWhitelister",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "governance", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "initialise", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "initialiseFixedAddress",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "proposeGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "proposedGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "revealPrices",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setContractAddresses",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "setTrustedAddresses",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "submitPriceHashes",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "transferGovernance",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "voterWhitelistBitmap",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "voterWhitelisted",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "votersRemovedFromWhitelist",
    data: BytesLike
  ): Result;
}

export namespace GovernanceProposedEvent {
  export type InputTuple = [proposedGovernance: AddressLike];
  export type OutputTuple = [proposedGovernance: string];
  export interface OutputObject {
    proposedGovernance: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace GovernanceUpdatedEvent {
  export type InputTuple = [
    oldGovernance: AddressLike,
    newGoveranance: AddressLike
  ];
  export type OutputTuple = [oldGovernance: string, newGoveranance: string];
  export interface OutputObject {
    oldGovernance: string;
    newGoveranance: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace PriceHashesSubmittedEvent {
  export type InputTuple = [
    submitter: AddressLike,
    epochId: BigNumberish,
    ftsos: AddressLike[],
    hashes: BytesLike[],
    timestamp: BigNumberish
  ];
  export type OutputTuple = [
    submitter: string,
    epochId: bigint,
    ftsos: string[],
    hashes: string[],
    timestamp: bigint
  ];
  export interface OutputObject {
    submitter: string;
    epochId: bigint;
    ftsos: string[];
    hashes: string[];
    timestamp: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export namespace PricesRevealedEvent {
  export type InputTuple = [
    voter: AddressLike,
    epochId: BigNumberish,
    ftsos: AddressLike[],
    prices: BigNumberish[],
    randoms: BigNumberish[],
    timestamp: BigNumberish
  ];
  export type OutputTuple = [
    voter: string,
    epochId: bigint,
    ftsos: string[],
    prices: bigint[],
    randoms: bigint[],
    timestamp: bigint
  ];
  export interface OutputObject {
    voter: string;
    epochId: bigint;
    ftsos: string[];
    prices: bigint[];
    randoms: bigint[];
    timestamp: bigint;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface PriceSubmitter extends BaseContract {
  connect(runner?: ContractRunner | null): PriceSubmitter;
  waitForDeployment(): Promise<this>;

  interface: PriceSubmitterInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  claimGovernance: TypedContractMethod<[], [void], "nonpayable">;

  getFtsoManager: TypedContractMethod<[], [string], "view">;

  getFtsoRegistry: TypedContractMethod<[], [string], "view">;

  getTrustedAddresses: TypedContractMethod<[], [string[]], "view">;

  getVoterWhitelister: TypedContractMethod<[], [string], "view">;

  governance: TypedContractMethod<[], [string], "view">;

  initialise: TypedContractMethod<[_governance: AddressLike], [void], "view">;

  initialiseFixedAddress: TypedContractMethod<[], [string], "nonpayable">;

  proposeGovernance: TypedContractMethod<
    [_governance: AddressLike],
    [void],
    "nonpayable"
  >;

  proposedGovernance: TypedContractMethod<[], [string], "view">;

  revealPrices: TypedContractMethod<
    [
      _epochId: BigNumberish,
      _ftsoIndices: BigNumberish[],
      _prices: BigNumberish[],
      _randoms: BigNumberish[]
    ],
    [void],
    "nonpayable"
  >;

  setContractAddresses: TypedContractMethod<
    [
      _ftsoRegistry: AddressLike,
      _voterWhitelister: AddressLike,
      _ftsoManager: AddressLike
    ],
    [void],
    "nonpayable"
  >;

  setTrustedAddresses: TypedContractMethod<
    [_trustedAddresses: AddressLike[]],
    [void],
    "nonpayable"
  >;

  submitPriceHashes: TypedContractMethod<
    [
      _epochId: BigNumberish,
      _ftsoIndices: BigNumberish[],
      _hashes: BytesLike[]
    ],
    [void],
    "nonpayable"
  >;

  transferGovernance: TypedContractMethod<
    [_governance: AddressLike],
    [void],
    "nonpayable"
  >;

  voterWhitelistBitmap: TypedContractMethod<
    [_voter: AddressLike],
    [bigint],
    "view"
  >;

  voterWhitelisted: TypedContractMethod<
    [_voter: AddressLike, _ftsoIndex: BigNumberish],
    [void],
    "nonpayable"
  >;

  votersRemovedFromWhitelist: TypedContractMethod<
    [_removedVoters: AddressLike[], _ftsoIndex: BigNumberish],
    [void],
    "nonpayable"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "claimGovernance"
  ): TypedContractMethod<[], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "getFtsoManager"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "getFtsoRegistry"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "getTrustedAddresses"
  ): TypedContractMethod<[], [string[]], "view">;
  getFunction(
    nameOrSignature: "getVoterWhitelister"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "governance"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "initialise"
  ): TypedContractMethod<[_governance: AddressLike], [void], "view">;
  getFunction(
    nameOrSignature: "initialiseFixedAddress"
  ): TypedContractMethod<[], [string], "nonpayable">;
  getFunction(
    nameOrSignature: "proposeGovernance"
  ): TypedContractMethod<[_governance: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "proposedGovernance"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "revealPrices"
  ): TypedContractMethod<
    [
      _epochId: BigNumberish,
      _ftsoIndices: BigNumberish[],
      _prices: BigNumberish[],
      _randoms: BigNumberish[]
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "setContractAddresses"
  ): TypedContractMethod<
    [
      _ftsoRegistry: AddressLike,
      _voterWhitelister: AddressLike,
      _ftsoManager: AddressLike
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "setTrustedAddresses"
  ): TypedContractMethod<
    [_trustedAddresses: AddressLike[]],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "submitPriceHashes"
  ): TypedContractMethod<
    [
      _epochId: BigNumberish,
      _ftsoIndices: BigNumberish[],
      _hashes: BytesLike[]
    ],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "transferGovernance"
  ): TypedContractMethod<[_governance: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "voterWhitelistBitmap"
  ): TypedContractMethod<[_voter: AddressLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "voterWhitelisted"
  ): TypedContractMethod<
    [_voter: AddressLike, _ftsoIndex: BigNumberish],
    [void],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "votersRemovedFromWhitelist"
  ): TypedContractMethod<
    [_removedVoters: AddressLike[], _ftsoIndex: BigNumberish],
    [void],
    "nonpayable"
  >;

  getEvent(
    key: "GovernanceProposed"
  ): TypedContractEvent<
    GovernanceProposedEvent.InputTuple,
    GovernanceProposedEvent.OutputTuple,
    GovernanceProposedEvent.OutputObject
  >;
  getEvent(
    key: "GovernanceUpdated"
  ): TypedContractEvent<
    GovernanceUpdatedEvent.InputTuple,
    GovernanceUpdatedEvent.OutputTuple,
    GovernanceUpdatedEvent.OutputObject
  >;
  getEvent(
    key: "PriceHashesSubmitted"
  ): TypedContractEvent<
    PriceHashesSubmittedEvent.InputTuple,
    PriceHashesSubmittedEvent.OutputTuple,
    PriceHashesSubmittedEvent.OutputObject
  >;
  getEvent(
    key: "PricesRevealed"
  ): TypedContractEvent<
    PricesRevealedEvent.InputTuple,
    PricesRevealedEvent.OutputTuple,
    PricesRevealedEvent.OutputObject
  >;

  filters: {
    "GovernanceProposed(address)": TypedContractEvent<
      GovernanceProposedEvent.InputTuple,
      GovernanceProposedEvent.OutputTuple,
      GovernanceProposedEvent.OutputObject
    >;
    GovernanceProposed: TypedContractEvent<
      GovernanceProposedEvent.InputTuple,
      GovernanceProposedEvent.OutputTuple,
      GovernanceProposedEvent.OutputObject
    >;

    "GovernanceUpdated(address,address)": TypedContractEvent<
      GovernanceUpdatedEvent.InputTuple,
      GovernanceUpdatedEvent.OutputTuple,
      GovernanceUpdatedEvent.OutputObject
    >;
    GovernanceUpdated: TypedContractEvent<
      GovernanceUpdatedEvent.InputTuple,
      GovernanceUpdatedEvent.OutputTuple,
      GovernanceUpdatedEvent.OutputObject
    >;

    "PriceHashesSubmitted(address,uint256,address[],bytes32[],uint256)": TypedContractEvent<
      PriceHashesSubmittedEvent.InputTuple,
      PriceHashesSubmittedEvent.OutputTuple,
      PriceHashesSubmittedEvent.OutputObject
    >;
    PriceHashesSubmitted: TypedContractEvent<
      PriceHashesSubmittedEvent.InputTuple,
      PriceHashesSubmittedEvent.OutputTuple,
      PriceHashesSubmittedEvent.OutputObject
    >;

    "PricesRevealed(address,uint256,address[],uint256[],uint256[],uint256)": TypedContractEvent<
      PricesRevealedEvent.InputTuple,
      PricesRevealedEvent.OutputTuple,
      PricesRevealedEvent.OutputObject
    >;
    PricesRevealed: TypedContractEvent<
      PricesRevealedEvent.InputTuple,
      PricesRevealedEvent.OutputTuple,
      PricesRevealedEvent.OutputObject
    >;
  };
}
