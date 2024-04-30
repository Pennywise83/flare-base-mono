export class PersistenceConstants {
    static CONSTANTS_INDEX = 'constants';
    static CONSTANTS_INDEX_MAPPING = {
        _source: {
            enabled: true
        }
    };
    static METADATA_INDEX = 'metadata';
    static METADATA_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            type: { type: 'keyword' },
            key: { type: 'keyword' },
            value: { type: 'keyword' },
            scanFrom: { type: 'long' },
            scanTo: { type: 'long' }
        }
    };


    static REWARD_EPOCHS_INDEX = 'rewardepochs';
    static REWARD_EPOCHS_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            id: { type: 'long' },
            votePowerBlockNumber: { type: 'long' },
            votePowerTimestamp: { type: 'date', format: 'epoch_millis' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            blockNumber: { type: 'long' }
        }
    };


    static PRICE_EPOCHS_INDEX = 'priceepochs';
    static PRICE_EPOCHS_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            id: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            blockNumber: { type: 'long' },
        }
    };


    static CLAIMED_REWARDS_INDEX = 'claimedrewards';
    static CLAIMED_REWARDS_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            timestamp: { type: 'date', format: 'epoch_millis' },
            blockNumber: { type: 'long' },
            scanFrom: { type: 'long' },
            scanTo: { type: 'long' },
            rewardEpochId: { type: 'long' },
            whoClaimed: { type: 'keyword' },
            sentTo: { type: 'keyword' },
            dataProvider: { type: 'keyword' },
            amount: { type: 'double' },
            claimable: { type: 'boolean' },
            claimed: { type: 'boolean' },
        }
    };
    static DELEGATIONS_INDEX = 'delegations';
    static DELEGATIONS_SNAPSHOT_INDEX = 'delegationssnapshot';

    static DELEGATORS_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            rewardEpoch: { type: 'long' },
            from: { type: 'keyword' },
            to: { type: 'keyword' },
            amount: { type: 'double' }
        }
    };

    static BALANCES_INDEX = 'balances';
    static BALANCES_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            address: { type: 'keyword' },
            addressA: { type: 'keyword' },
            addressB: { type: 'keyword' },
            amount: { type: 'double' }
        }
    };

    static FTSO_INFO_INDEX = 'ftso_info';
    static FTSO_INFO_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            timestamp: { type: 'date', format: 'epoch_millis' },
            address: { type: 'keyword' },
            name: { type: 'keyword' },
            description: { type: 'text' },
            icon: { type: 'keyword' },
            url: { type: 'keyword' },
            listed: { type: 'boolean' },
        }
    };

    static VOTER_WHITELIST_INDEX = 'voterwhitelist';
    static VOTER_WHITELIST_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            address: { type: 'keyword' },
            symbol: { type: 'keyword' },
            whitelisted: { type: 'boolean' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            blockNumber: { type: 'long' }
        }
    };

    static FINALIZED_PRICES_V1_INDEX = 'v1finalizedprices';
    static FINALIZED_PRICES_V1_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            epochId: { type: 'long' },
            symbol: { type: 'keyword' },
            value: { type: 'double' },
            rewardedSymbol: { type: 'boolean' },
            lowIQRRewardPrice: { type: 'double' },
            highIQRRewardPrice: { type: 'double' },
            lowPctRewardPrice: { type: 'double' },
            highPctRewardPrice: { type: 'double' },

        }
    };

    static HASHES_SUBMITTED_V1_INDEX = 'v1submittedhashes';
    static HASHES_SUBMITTED_V1_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            epochId: { type: 'long' },
            submitter: { type: 'keyword' },
        }
    };

    static REVEALED_PRICES_V1_INDEX = 'v1revealedprices';
    static REVEALED_PRICES_V1_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            epochId: { type: 'long' },
            symbol: { type: 'keyword' },
            value: { type: 'double' },
            dataProvider: { type: 'keyword' },
            innerIQR: { type: 'boolean' },
            innerPct: { type: 'boolean' },
            borderIQR: { type: 'boolean' },
            borderPct: { type: 'boolean' },
            outIQR: { type: 'boolean' },
            outPct: { type: 'boolean' },
            rewardedSymbol: { type: 'boolean' }

        }
    };

    static FTSO_FEE_V1_INDEX = 'v1ftsofees';
    static FTSO_FEE_V1_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            dataProvider: { type: 'keyword' },
            validFromEpoch: { type: 'long' },
            value: { type: 'double' },
        }
    };

    static FTSO_REWARD_DISTRIBUTED_V1_INDEX = 'v1rewarddistributed';
    static FTSO_REWARD_DISTRIBUTED_V1_INDEX_MAPPING = {
        _source: {
            enabled: true
        },
        properties: {
            blockNumber: { type: 'long' },
            timestamp: { type: 'date', format: 'epoch_millis' },
            dataProvider: { type: 'keyword' },
            symbol: { type: 'keyword' },
            priceEpochId: { type: 'long' },
            rewardEpochId: { type: 'long' },
            providerReward: { type: 'double' },
            reward: { type: 'double' }
        }
    };

}


/*
{
    from: "a",
    "to": "b",
    "votePower": 1000
},
{
    from: "c",
    "to": "b",
    "votePower": 100
}
*/