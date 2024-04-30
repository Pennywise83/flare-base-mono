export class PersistenceMetadataScanInfo {
    from: number;
    to: number;
}

export class PersistenceMetadata extends PersistenceMetadataScanInfo {
    type: PersistenceMetadataType;
    value: any;
    filter: string;

    findMissingIntervals(data: PersistenceMetadata[], from: number, to: number, value?: string): PersistenceMetadataScanInfo[] {
        if (data.length === 0) {
            return [{ from: from, to: to }];
        }

        data.sort((a, b) => a.from - b.from);
        const missingIntervals: PersistenceMetadataScanInfo[] = [];
        let currentTo = from; // Cambiato da currentFrom a currentTo

        for (const item of data) {
            if (currentTo < item.from) {
                missingIntervals.push({
                    from: currentTo,
                    to: item.from
                });
            }
            currentTo = Math.max(currentTo, item.to); // Aggiunto Math.max per tenere traccia del massimo "to"
        }

        if (currentTo < to) {
            missingIntervals.push({
                from: currentTo,
                to: to
            });
        }
        return missingIntervals;
    }
    removeDuplicates = (input: PersistenceMetadata[]): PersistenceMetadata[] => {
        const uniqueObjects: PersistenceMetadata[] = [];

        input.forEach((obj) => {
            const isDuplicate = uniqueObjects.some(
                (uniqueObj) =>
                    uniqueObj.from === obj.from && uniqueObj.to === obj.to && uniqueObj.value === obj.value
            );

            if (!isDuplicate) {
                delete obj.removeDuplicates;
                uniqueObjects.push(obj);
            }
        });
        return uniqueObjects;
    };
}

export enum PersistenceMetadataType {
    Reward = "Reward",
    Delegation = "Delegation",
    DelegationSnapshot = "DelegationSnapshot",
    PriceEpoch = "PriceEpoch",
    Balance = "Balance",
    VoterWhitelist = "VoterWhitelist",
    FinalizedPrice = "FinalizedPrice",
    RevealedPrice = "RevealedPrice",
    FtsoFee = "FtsoFee",
    RewardDistributed = "RewardDistributed",
    HashSubmitted = "HashSubmitted",
}