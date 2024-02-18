import { BlockInfo } from "../blockchain";

export class HashSubmitted extends BlockInfo {
    submitter: string;
    epochId: number;

}