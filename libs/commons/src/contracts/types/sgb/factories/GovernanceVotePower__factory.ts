/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Interface, type ContractRunner } from "ethers";
import type {
  GovernanceVotePower,
  GovernanceVotePowerInterface,
} from "../GovernanceVotePower";

const _abi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      {
        type: "address",
        name: "_ownerToken",
        internalType: "contract IVPToken",
      },
    ],
  },
  {
    type: "event",
    name: "DelegateChanged",
    inputs: [
      {
        type: "address",
        name: "delegator",
        internalType: "address",
        indexed: true,
      },
      {
        type: "address",
        name: "fromDelegate",
        internalType: "address",
        indexed: true,
      },
      {
        type: "address",
        name: "toDelegate",
        internalType: "address",
        indexed: true,
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "DelegateVotesChanged",
    inputs: [
      {
        type: "address",
        name: "delegate",
        internalType: "address",
        indexed: true,
      },
      {
        type: "uint256",
        name: "previousBalance",
        internalType: "uint256",
        indexed: false,
      },
      {
        type: "uint256",
        name: "newBalance",
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
        type: "address",
        name: "",
        internalType: "address",
      },
    ],
    name: "cleanerContract",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "delegate",
    inputs: [
      {
        type: "address",
        name: "_to",
        internalType: "address",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "delegatedGovernanceVotePowerHistoryCleanup",
    inputs: [
      {
        type: "address",
        name: "_owner",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "_count",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
    ],
    name: "delegatesHistoryCleanup",
    inputs: [
      {
        type: "address",
        name: "_owner",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "_count",
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
    name: "getCleanupBlockNumber",
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
    name: "getDelegateOfAt",
    inputs: [
      {
        type: "address",
        name: "_who",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "_blockNumber",
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
        internalType: "address",
      },
    ],
    name: "getDelegateOfAtNow",
    inputs: [
      {
        type: "address",
        name: "_who",
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
    name: "getVotes",
    inputs: [
      {
        type: "address",
        name: "_who",
        internalType: "address",
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
        internalType: "contract IVPToken",
      },
    ],
    name: "ownerToken",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "setCleanerContract",
    inputs: [
      {
        type: "address",
        name: "_cleanerContract",
        internalType: "address",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "setCleanupBlockNumber",
    inputs: [
      {
        type: "uint256",
        name: "_blockNumber",
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "undelegate",
    inputs: [],
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [],
    name: "updateAtTokenTransfer",
    inputs: [
      {
        type: "address",
        name: "_from",
        internalType: "address",
      },
      {
        type: "address",
        name: "_to",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
      {
        type: "uint256",
        name: "",
        internalType: "uint256",
      },
      {
        type: "uint256",
        name: "_amount",
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
    name: "votePowerOfAt",
    inputs: [
      {
        type: "address",
        name: "_who",
        internalType: "address",
      },
      {
        type: "uint256",
        name: "_blockNumber",
        internalType: "uint256",
      },
    ],
  },
] as const;

export class GovernanceVotePower__factory {
  static readonly abi = _abi;
  static createInterface(): GovernanceVotePowerInterface {
    return new Interface(_abi) as GovernanceVotePowerInterface;
  }
  static connect(
    address: string,
    runner?: ContractRunner | null
  ): GovernanceVotePower {
    return new Contract(
      address,
      _abi,
      runner
    ) as unknown as GovernanceVotePower;
  }
}
