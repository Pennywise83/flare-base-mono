
import { Test } from '@nestjs/testing';
import { DistributedLockService } from './distributed-lock.service';
import { Lock } from 'redlock';

describe('Distributed lock test suite', () => {
    let _distributedLockService: DistributedLockService;

    beforeEach(async () => {
        process.argv[2] = './config-test.yml';
        const moduleRef = await Test.createTestingModule({
            providers: [
                DistributedLockService,
            ],
        }).compile();

        _distributedLockService = moduleRef.get<DistributedLockService>(DistributedLockService);
    });

    describe('Test lock', () => {
        it('Test case 1', async () => {
            let lockResult1: boolean = false;
            let lockResult2: boolean = false;
            let lockResult3: boolean = false;
            let lockAcquiredAttempt1: boolean = await _distributedLockService.acquireLockWithTimeout("Lock1", 3000, 3);
            lockResult1 = true;
            expect(lockResult1).toEqual(true);
            setTimeout(async () => {
                await _distributedLockService.releaseLock('Lock1');
                let lockAcquiredAttempt3: boolean = await _distributedLockService.acquireLockWithTimeout("Lock1", 3000, 3);
                lockResult3 = true;
                expect(lockResult3).toEqual(true);
            }, 4000);

            let lockAcquiredAttempt2: boolean = await _distributedLockService.acquireLockWithTimeout("Lock1", 3000, 3);
            if (!lockAcquiredAttempt2) {
                expect(lockResult2).toEqual(false);
            }


        }, 60000);

    });
});