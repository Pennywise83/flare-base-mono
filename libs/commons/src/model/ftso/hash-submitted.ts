import { isNotEmpty } from "class-validator";
import { BlockInfo } from "../blockchain";

export class HashSubmitted extends BlockInfo {
    submitter: string;
    epochId: number;

}
export class HashSubmittedMatrix {
    timestamp: (number | null)[];
    epochId: (number | null)[];
    submitter: (string | null)[];
    toObject(data: HashSubmittedMatrix): HashSubmitted[] {
        let results: HashSubmitted[] = [];
        data.epochId.forEach((element, idx) => {
            let obj: HashSubmitted = new HashSubmitted();
            obj.timestamp = data.timestamp[idx]!;
            obj.epochId = data.epochId[idx]!;
            obj.submitter = data.submitter[idx]!;
            results.push(obj);
        })
        return results;
    }
    constructor(submittedHashes?: HashSubmitted[]) {
        if (isNotEmpty(submittedHashes)) {
            this.timestamp = submittedHashes.map(item => isNotEmpty(item.timestamp) ? item.timestamp : null);
            this.epochId = submittedHashes.map(item => isNotEmpty(item.epochId) ? item.epochId : null);
            this.submitter = submittedHashes.map(item => isNotEmpty(item.submitter) ? item.submitter : null);

        }
    }
}

export enum HashSubmittedSortEnum {
    submitter = 'submitter',
    epochId = 'epochId'
}
