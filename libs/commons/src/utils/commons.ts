import { Title } from "@angular/platform-browser";
import { SHA256 } from 'crypto-js';
import { MatomoTracker } from 'ngx-matomo';
import { PaginatedResult, SortOrderEnum } from "../model";
import { AggregationInterval } from "../model/aggregation-intervals";
import { BlockScanInfo, NetworkEnum } from "../model/blockchain";


export class Commons {
    static findMissingItems<T>(sourceData: any[], targetData: any[], sourceKey?: string, targetKey?: string): T[] {
        const sourceItems = new Set(sourceKey ? sourceData.map(item => item[sourceKey]) : sourceData);
        const missingItems: T[] = targetData.filter(item => {
            if (targetKey === undefined) {
                return !sourceItems.has(item);
            } else {
                if (targetKey in item) {
                    return !sourceItems.has(item[targetKey]);
                } else {
                    return true; // Ignore items without the targetKey property
                }
            }
        });
        return missingItems;
    }
    public static chunkIt<T>(arr: Array<T>, size: number): Array<Array<T>> {
        let buckets: Array<Array<T>> = [];

        // Just create the buckets/chunks storage
        for (let i = 0; i < Math.ceil(arr.length / size); i++) {
            buckets.push([]);
        }

        // Put in the buckets/storage by index access only
        for (let i = 0; i < arr.length; i++) {
            var arrIndex = Math.floor(i / size);
            buckets[arrIndex].push(arr[i]);
        }

        return buckets;
    }
    static clone(object: any): any {
        return JSON.parse(JSON.stringify(object));
    }
    static findNonSequentialRanges(from: number, to: number, data: BlockScanInfo[]): BlockScanInfo[] {
        const results: BlockScanInfo[] = [];
        const sortedData = data.sort((a, b) => a.scanFrom - b.scanFrom);

        let prevTo = from;

        for (const block of sortedData) {
            if (block.scanFrom > prevTo) {
                results.push({ scanFrom: prevTo, scanTo: block.scanFrom });
            }
            prevTo = Math.max(prevTo, block.scanTo);
        }

        if (prevTo < to) {
            results.push({ scanFrom: prevTo, scanTo: to });
        }

        return results;
    }
    static async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }


    static sha256Hash(inputString: string): string {
        return SHA256(inputString).toString();
    }
    static objectsToCsv<T>(objects: T[]): string {
        if (objects.length === 0) {
            return '';
        }
        const columns = Object.keys(objects[0]).sort((a, b) => a.localeCompare(b));
        const header = columns.join(';');
        const rows = objects.map(obj => columns.map(col => (obj as any)[col]).join(';'));
        return [header, ...rows].join('\n');
    }
    static parsePaginatedResults<T>(results: T[], page: number, pageSize: number, sortField: string, sortOrder: SortOrderEnum): PaginatedResult<T[]> {
        let pResult: PaginatedResult<T[]> = new PaginatedResult(page, pageSize, sortField, sortOrder, 0, []);
        if (sortField) {
            results.sort((a, b) => {
                if (sortOrder === 'asc') {
                    return (a as any)[sortField] - (b as any)[sortField];
                } else {
                    return (b as any)[sortField] - (a as any)[sortField];
                }
            });
        }
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedResults = results.slice(startIndex, endIndex);
        pResult.numResults = results.length;
        pResult.results = paginatedResults;
        return pResult;


    }

    static getHistogramPointsFromInterval(timeInterval: string, from: number, to: number): number {
        const intervalInMillis = AggregationInterval[timeInterval];
        if (intervalInMillis === undefined) {
            throw new Error("Invalid time interval");
        }

        const difference = to - from;
        return Math.ceil(difference / intervalInMillis);
    }

    static getBestHistogramPointsInterval(from: number, to: number, targetPoints: number): string {
        let resultInterval: string = null;
        for (const intervalKey in AggregationInterval) {
            const timeInterval = AggregationInterval[intervalKey];
            const points = Commons.getHistogramPointsFromInterval(intervalKey, from, to);

            if (points <= targetPoints && resultInterval === null) {
                resultInterval = intervalKey;
            }
        }
        return resultInterval;
    }

    static setPageTitle(title: string, titleService: Title, tracker: MatomoTracker): void {
        titleService.setTitle(title);
        tracker.setDocumentTitle(title);
        tracker.trackPageView(title);
    }
    static divideBlocks = (blockStart: number, blockEnd: number, blockSize: number): { from: number, to: number }[] =>
        Array.from({ length: Math.ceil((blockEnd - blockStart) / blockSize) }, (_, index) => ({
            from: blockStart + index * blockSize,
            to: Math.min(blockStart + (index + 1) * blockSize - 1, blockEnd)
        }));

    static getNativeCurrency(network: NetworkEnum): string {
        switch (network) {
            case NetworkEnum.flare:
                return 'FLR';
                break;
            case NetworkEnum.songbird:
                return 'SGB';
                break;
        }
    }

}