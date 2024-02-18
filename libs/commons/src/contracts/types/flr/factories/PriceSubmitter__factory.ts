/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Interface, type ContractRunner } from "ethers";
import type {
  PriceSubmitter,
  PriceSubmitterInterface,
} from "../PriceSubmitter";

const _abi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [],
  },
  {
    type: "event",
    name: "GovernanceCallTimelocked",
    inputs: [
      {
        type: "bytes4",
        name: "selector",
        internalType: "bytes4",
        indexed: false,
      },
      {
        type: "uint256",
        name: "allowedAfterTimestamp",
        internalType: "uint256",
        indexed: false,
      },
      {
        type: "bytes",
        name: "encodedCall",
        internalType: "bytes",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GovernanceInitialised",
    inputs: [
      {
        type: "address",
        name: "initialGovernance",
        internalType: "address",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GovernedProductionModeEntered",
    inputs: [
      {
        type: "address",
        name: "governanceSettings",
        internalType: "address",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "HashSubmitted",
    inputs: [
      {
        type: "address",
        name: "submitter",
        internalType: "address",
        indexed: true,
      },
      {
        type: "uint256",
        name: "epochId",
        internalType: "uint256",
        indexed: true,
      },
      {
        type: "bytes32",
        name: "hash",
        internalType: "bytes32",
        indexed: false,
      },
      {
        type: "uint256",
        name: "timestamp",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PricesRevealed",
    inputs: [
      {
        type: "address",
        name: "voter",
        internalType: "address",
        indexed: true,
      },
      {
        type: "uint256",
        name: "epochId",
        internalType: "uint256",
        indexed: true,
      },
      {
        type: "address[]",
        name: "ftsos",
        internalType: "contract IFtsoGenesis[]",
        indexed: false,
      },
      {
        type: "uint256[]",
        name: "prices",
        internalType: "uint256[]",
        indexed: false,
      },
      {
        type: "uint256",
        name: "random",
        internalType: "uint256",
        indexed: false,
      },
      {
        type: "uint256",
        name: "timestamp",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TimelockedGovernanceCallCanceled",
    inputs: [
      {
        type: "bytes4",
        name: "selector",
        internalType: "bytes4",
        indexed: false,
      },
      {
        type: "uint256",
        name: "timestamp",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TimelockedGovernanceCallExecuted",
    inputs: [
      {
        type: "bytes4",
        name: "selector",
        internalType: "bytes4",
        indexed: false,
      },
      {
        type: "uint256",
        name: "timestamp",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "MINIMAL_RANDOM",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "RANDOM_EPOCH_CYCLIC_BUFFER_SIZE",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "cancelGovernanceCall",
    inputs: [
      {
        type: "bytes4",
        name: "_selector",
        internalType: "bytes4",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "executeGovernanceCall",
    inputs: [
      {
        type: "bytes4",
        name: "_selector",
        internalType: "bytes4",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "_addressUpdater",
        internalType: "address",
      },
    ],
    name: "getAddressUpdater",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "getCurrentRandom",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "contract IFtsoManagerGenesis",
      },
    ],
    name: "getFtsoManager",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "contract IFtsoRegistryGenesis",
      },
    ],
    name: "getFtsoRegistry",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "getRandom",
    inputs: [
      {
        type: "uint256",
        name: "_epochId",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address[]",
        name: "",
        internalType: "address[]",
      },
    ],
    name: "getTrustedAddresses",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "address",
      },
    ],
    name: "getVoterWhitelister",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "address",
      },
    ],
    name: "governance",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "contract IGovernanceSettings",
      },
    ],
    name: "governanceSettings",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "pure",
    outputs: [],
    name: "initialise",
    inputs: [
      {
        type: "address",
        name: "_governance",
        internalType: "address",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "address",
      },
    ],
    name: "initialiseFixedAddress",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "bool",
        name: "",
        internalType: "bool",
      },
    ],
    name: "productionMode",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "revealPrices",
    inputs: [
      {
        type: "uint256",
        name: "_epochId",
        internalType: "uint256",
      },
      {
        type: "uint256[]",
        name: "_ftsoIndices",
        internalType: "uint256[]",
      },
      {
        type: "uint256[]",
        name: "_prices",
        internalType: "uint256[]",
      },
      {
        type: "uint256",
        name: "_random",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "setAddressUpdater",
    inputs: [
      {
        type: "address",
        name: "_addressUpdater",
        internalType: "address",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "setTrustedAddresses",
    inputs: [
      {
        type: "address[]",
        name: "_trustedAddresses",
        internalType: "address[]",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "submitHash",
    inputs: [
      {
        type: "uint256",
        name: "_epochId",
        internalType: "uint256",
      },
      {
        type: "bytes32",
        name: "_hash",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "switchToProductionMode",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "allowedAfterTimestamp",
        internalType: "uint256",
      },
      {
        type: "bytes",
        name: "encodedCall",
        internalType: "bytes",
      },
    ],
    name: "timelockedCalls",
    inputs: [
      {
        type: "bytes4",
        name: "",
        internalType: "bytes4",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "updateContractAddresses",
    inputs: [
      {
        type: "bytes32[]",
        name: "_contractNameHashes",
        internalType: "bytes32[]",
      },
      {
        type: "address[]",
        name: "_contractAddresses",
        internalType: "address[]",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "voterWhitelistBitmap",
    inputs: [
      {
        type: "address",
        name: "_voter",
        internalType: "address",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "voterWhitelisted",
    inputs: [
      {
        type: "address",
        name: "_voter",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "_ftsoIndex",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "votersRemovedFromWhitelist",
    inputs: [
      {
        type: "address[]",
        name: "_removedVoters",
        internalType: "address[]",
      },
      {
        type: "uint256",
        name: "_ftsoIndex",
        internalType: "uint256",
      },
    ],
  },
] as const;

export class PriceSubmitter__factory {
  static readonly abi = _abi;
  static createInterface(): PriceSubmitterInterface {
    return new Interface(_abi) as PriceSubmitterInterface;
  }
  static connect(
    address: string,
    runner?: ContractRunner | null
  ): PriceSubmitter {
    return new Contract(address, _abi, runner) as unknown as PriceSubmitter;
  }
}
