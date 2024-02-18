import { TransactionOperationEnum } from "./transaction-operation.enum";

export class Web3ClientMessage {
    operation: TransactionOperationEnum = null;
    message: string = null;
    txId: string = null;
    constructor(operation?: TransactionOperationEnum, message?: string, txId?: string) {
        if (operation) {
            this.operation = operation;
        }
        if (message) {
            this.message = message;
        }
        if (txId) {
            this.txId = txId;
        }
    }
}