// lock.service.ts
import { Injectable, Logger } from '@nestjs/common';
import Client from 'ioredis';
import Redlock, { Lock } from 'redlock';
const DEFAULT_TTL = 60 * 2 * 1000;
@Injectable()
export class DistributedLockService {
    logger: Logger = new Logger(DistributedLockService.name);
    private readonly redisClient: Client;
    private readonly redlock: Redlock;


    constructor() {
        // Configura la connessione a Redis
  /*       this.redisClient = new Client({
            host: 'localhost', // Indirizzo del server Redis
            port: 7000,        // Porta di Redis
        }); */
        this.redlock = new Redlock([this.redisClient]);
        this.logger.log('Lock service initialized')
    }


    async acquireLockWithTimeout(resource: string, timeout: number): Promise<Lock | null> {
        const startTimestamp = Date.now();
        while (Date.now() - startTimestamp < timeout) {
            try {
                const lock = await this.redlock.acquire([resource], DEFAULT_TTL);
                return lock;
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return null;
    }



    async releaseLock(lock: Lock): Promise<void> {
        await this.redlock.release(lock);

        return;
    }
}
