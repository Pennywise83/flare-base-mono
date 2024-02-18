/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Interface, type ContractRunner } from "ethers";
import type {
  VoterWhitelister,
  VoterWhitelisterInterface,
} from "../VoterWhitelister";

const _abi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "address",
        name: "_governance",
        internalType: "address",
      },
      {
        type: "address",
        name: "_addressUpdater",
        internalType: "address",
      },
      {
        type: "address",
        name: "_priceSubmitter",
        internalType: "contract IIPriceSubmitter",
      },
      {
        type: "uint256",
        name: "_defaultMaxVotersForFtso",
        internalType: "uint256",
      },
      {
        type: "address",
        name: "_oldVoterWhitelister",
        internalType: "contract IVoterWhitelister",
      },
    ],
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
    type: "event",
    name: "VoterChilled",
    inputs: [
      {
        type: "address",
        name: "voter",
        internalType: "address",
        indexed: false,
      },
      {
        type: "uint256",
        name: "untilRewardEpoch",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VoterRemovedFromWhitelist",
    inputs: [
      {
        type: "address",
        name: "voter",
        internalType: "address",
        indexed: false,
      },
      {
        type: "uint256",
        name: "ftsoIndex",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "VoterWhitelisted",
    inputs: [
      {
        type: "address",
        name: "voter",
        internalType: "address",
        indexed: false,
      },
      {
        type: "uint256",
        name: "ftsoIndex",
        internalType: "uint256",
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "addFtso",
    inputs: [
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
    outputs: [
      {
        type: "bool[]",
        name: "_removed",
        internalType: "bool[]",
      },
      {
        type: "uint256",
        name: "_untilRewardEpoch",
        internalType: "uint256",
      },
    ],
    name: "chillVoter",
    inputs: [
      {
        type: "address",
        name: "_voter",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "_noOfRewardEpochs",
        internalType: "uint256",
      },
      {
        type: "uint256[]",
        name: "_ftsoIndices",
        internalType: "uint256[]",
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
    name: "chilledUntilRewardEpoch",
    inputs: [
      {
        type: "address",
        name: "",
        internalType: "address",
      },
    ],
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
    name: "copyMode",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "copyWhitelist",
    inputs: [
      {
        type: "uint256",
        name: "_ftsoIndex",
        internalType: "uint256",
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
    name: "defaultMaxVotersForFtso",
    inputs: [],
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
        name: "",
        internalType: "contract IFtsoManager",
      },
    ],
    name: "ftsoManager",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "contract IFtsoRegistry",
      },
    ],
    name: "ftsoRegistry",
    inputs: [],
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
        type: "address[]",
        name: "",
        internalType: "address[]",
      },
    ],
    name: "getFtsoWhitelistedPriceProviders",
    inputs: [
      {
        type: "uint256",
        name: "_ftsoIndex",
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
    name: "getFtsoWhitelistedPriceProvidersBySymbol",
    inputs: [
      {
        type: "string",
        name: "_symbol",
        internalType: "string",
      },
    ],
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
    stateMutability: "nonpayable",
    outputs: [],
    name: "initialise",
    inputs: [
      {
        type: "address",
        name: "_initialGovernance",
        internalType: "address",
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
    name: "maxVotersForFtso",
    inputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "contract IVoterWhitelister",
      },
    ],
    name: "oldVoterWhitelister",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "view",
    outputs: [
      {
        type: "address",
        name: "",
        internalType: "contract IIPriceSubmitter",
      },
    ],
    name: "priceSubmitter",
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
    name: "removeFtso",
    inputs: [
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
    name: "removeTrustedAddressFromWhitelist",
    inputs: [
      {
        type: "address",
        name: "_trustedAddress",
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
    outputs: [
      {
        type: "uint256[]",
        name: "_supportedIndices",
        internalType: "uint256[]",
      },
      {
        type: "bool[]",
        name: "_success",
        internalType: "bool[]",
      },
    ],
    name: "requestFullVoterWhitelisting",
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
    name: "requestWhitelistingVoter",
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
    name: "setDefaultMaxVotersForFtso",
    inputs: [
      {
        type: "uint256",
        name: "_defaultMaxVotersForFtso",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "setMaxVotersForFtso",
    inputs: [
      {
        type: "uint256",
        name: "_ftsoIndex",
        internalType: "uint256",
      },
      {
        type: "uint256",
        name: "_newMaxVoters",
        internalType: "uint256",
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
    name: "turnOffCopyMode",
    inputs: [],
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
] as const;

export class VoterWhitelister__factory {
  static readonly abi = _abi;
  static createInterface(): VoterWhitelisterInterface {
    return new Interface(_abi) as VoterWhitelisterInterface;
  }
  static connect(
    address: string,
    runner?: ContractRunner | null
  ): VoterWhitelister {
    return new Contract(address, _abi, runner) as unknown as VoterWhitelister;
  }
}
