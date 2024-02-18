// This file contains the chain configurations. Fill with the corract contract addresses.

import { NetworkEnum } from "../../../../../../../libs/commons/src";
import { IChainDefinition } from "./i-chain-definition";

// This one is used for development
export const availableChains: IChainDefinition[] = [
  {
    "network": NetworkEnum.flare,
    "chainId": 14,
    "rpcUrls": [
      "https://flare-api.flare.network/ext/C/rpc",
      "https://flare.public-rpc.com",
      "https://rpc.ftso.au/flare"
    ],
    "chainName": "Flare Mainnet",
    "nativeCurrency": {
      "name": "Flare",
      "symbol": "FLR",
      "decimals": 18,
      "icon": "assets/icons/FLR.png"
    },
    "wrappedCurrency": {
      "name": "Wrapped Flare",
      "symbol": "wFLR",
      "decimals": 18,
      "icon": "assets/icons/WFLR.png",
    },
    "blockExplorerUrls": [
      "https://flarescan.com/"
    ],
    "priceSubmitterContract": "0x1000000000000000000000000000000000000003",
    "rewardDistributorContractAddress": "0x171eB1f854A7e542D88d6f6fb8827C83236C1937"
  },
  {
    "network": NetworkEnum.songbird,
    "chainId": 19,
    "rpcUrls": [
      "https://songbird-api.flare.network/ext/C/rpc"
    ],
    "chainName": "Songbird Canary-Network",
    "nativeCurrency": {
      "name": "Songbird",
      "symbol": "SGB",
      "decimals": 18,
      "icon": "assets/icons/SGB.png"
    },
    "wrappedCurrency": {
      "name": "Wrapped Songbird",
      "symbol": "wSGB",
      "decimals": 18,
      "icon": "assets/icons/WSGB.png"
    },
    "blockExplorerUrls": [
      "https://flarescan.com/"
    ],
    "priceSubmitterContract": "0x1000000000000000000000000000000000000003",
    "rewardDistributorContractAddress": "0xc2826E4Ed912fB1EAC94c2Ce97e4111780Cd85be"
  },
];