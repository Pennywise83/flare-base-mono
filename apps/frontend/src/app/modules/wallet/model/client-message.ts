export class ClientMessage {
    title: string = null;
    message: string = null;
    txUrl: string = null;
    type: string = 'info';

    reset() {
        this.title = null;
        this.message = null;
    }
    hasMessage(): boolean {
        if ((this.title != null && this.title != '') || this.message != null && this.message != '') {
            return true;
        } else {
            return false;
        }
    }
    constructor(title?: string, message?: string, txId?: string, type?: string) {
        if (title) {
            this.title = title;
        }
        if (message) {
            this.message = message;
        }
        if (txId && txId != null) {
            this.txUrl = txId;
        }
        if (type) {
            this.type = type;
        }
    }
}