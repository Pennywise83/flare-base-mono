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

export declare namespace IRewardDistributorFactory {
  export type NamedInstanceStruct = {
    instance: AddressLike;
    description: string;
  };

  export type NamedInstanceStructOutput = [
    instance: string,
    description: string
  ] & { instance: string; description: string };
}

export interface RewardDistributorFactoryInterface extends Interface {
  getFunction(
    nameOrSignature: "count" | "create" | "get" | "getAll" | "remove" | "rename"
  ): FunctionFragment;

  getEvent(nameOrSignatureOrTopic: "Created"): EventFragment;

  encodeFunctionData(functionFragment: "count", values: [AddressLike]): string;
  encodeFunctionData(
    functionFragment: "create",
    values: [
      AddressLike,
      BigNumberish,
      AddressLike[],
      BigNumberish[],
      boolean[],
      boolean,
      string
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "get",
    values: [AddressLike, BigNumberish]
  ): string;
  encodeFunctionData(functionFragment: "getAll", values: [AddressLike]): string;
  encodeFunctionData(functionFragment: "remove", values: [AddressLike]): string;
  encodeFunctionData(
    functionFragment: "rename",
    values: [AddressLike, string]
  ): string;

  decodeFunctionResult(functionFragment: "count", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "create", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "get", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "getAll", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "remove", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "rename", data: BytesLike): Result;
}

export namespace CreatedEvent {
  export type InputTuple = [instance: AddressLike, provider: AddressLike];
  export type OutputTuple = [instance: string, provider: string];
  export interface OutputObject {
    instance: string;
    provider: string;
  }
  export type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
  export type Filter = TypedDeferredTopicFilter<Event>;
  export type Log = TypedEventLog<Event>;
  export type LogDescription = TypedLogDescription<Event>;
}

export interface RewardDistributorFactory extends BaseContract {
  connect(runner?: ContractRunner | null): RewardDistributorFactory;
  waitForDeployment(): Promise<this>;

  interface: RewardDistributorFactoryInterface;

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

  count: TypedContractMethod<[owner: AddressLike], [bigint], "view">;

  create: TypedContractMethod<
    [
      provider: AddressLike,
      reserveBalance: BigNumberish,
      recipients: AddressLike[],
      bips: BigNumberish[],
      wrap: boolean[],
      editable: boolean,
      description: string
    ],
    [string],
    "nonpayable"
  >;

  get: TypedContractMethod<
    [owner: AddressLike, i: BigNumberish],
    [[string, string] & { instance: string; description: string }],
    "view"
  >;

  getAll: TypedContractMethod<
    [owner: AddressLike],
    [IRewardDistributorFactory.NamedInstanceStructOutput[]],
    "view"
  >;

  remove: TypedContractMethod<[instance: AddressLike], [void], "nonpayable">;

  rename: TypedContractMethod<
    [instance: AddressLike, description: string],
    [void],
    "nonpayable"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "count"
  ): TypedContractMethod<[owner: AddressLike], [bigint], "view">;
  getFunction(
    nameOrSignature: "create"
  ): TypedContractMethod<
    [
      provider: AddressLike,
      reserveBalance: BigNumberish,
      recipients: AddressLike[],
      bips: BigNumberish[],
      wrap: boolean[],
      editable: boolean,
      description: string
    ],
    [string],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "get"
  ): TypedContractMethod<
    [owner: AddressLike, i: BigNumberish],
    [[string, string] & { instance: string; description: string }],
    "view"
  >;
  getFunction(
    nameOrSignature: "getAll"
  ): TypedContractMethod<
    [owner: AddressLike],
    [IRewardDistributorFactory.NamedInstanceStructOutput[]],
    "view"
  >;
  getFunction(
    nameOrSignature: "remove"
  ): TypedContractMethod<[instance: AddressLike], [void], "nonpayable">;
  getFunction(
    nameOrSignature: "rename"
  ): TypedContractMethod<
    [instance: AddressLike, description: string],
    [void],
    "nonpayable"
  >;

  getEvent(
    key: "Created"
  ): TypedContractEvent<
    CreatedEvent.InputTuple,
    CreatedEvent.OutputTuple,
    CreatedEvent.OutputObject
  >;

  filters: {
    "Created(address,address)": TypedContractEvent<
      CreatedEvent.InputTuple,
      CreatedEvent.OutputTuple,
      CreatedEvent.OutputObject
    >;
    Created: TypedContractEvent<
      CreatedEvent.InputTuple,
      CreatedEvent.OutputTuple,
      CreatedEvent.OutputObject
    >;
  };
}
