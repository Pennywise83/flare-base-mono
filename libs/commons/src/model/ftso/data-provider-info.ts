export class DataProviderInfo {
    address: string;
    name: string;
    description: string;
    icon: string;
    url: string;
    listed: boolean;
    constructor() {
        this.address = null;
        this.name = 'Unknown provider';
        this.icon = 'assets/images/unknown.png';
    }
}