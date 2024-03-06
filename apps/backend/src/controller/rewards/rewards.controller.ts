import { ActionResult, ClaimedRewardHistogramElement, ClaimedRewardsGroupByEnum, ClaimedRewardsSortEnum, Commons, NetworkEnum, PaginatedResult, RewardDTO, SortOrderEnum } from "@flare-base/commons";
import { Controller, Get, Headers, HttpStatus, Logger, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiHeader, ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { isEmpty } from "class-validator";
import { ApiActionResult } from "libs/commons/src/model/action-result";
import { ApiPaginatedResult } from "libs/commons/src/model/paginated-result";
import { RewardsService } from "../../service/rewards/rewards.service";
import { AddressValidationPipe } from "../model/address-validation-pipe";
import { AggregationIntervalDTO, AggregationIntervalValidationPipe } from "../model/aggregation-interval-validation-pipe";
import { ClaimedRewardsGroupByDTO, ClaimedRewardsGroupByValidationPipe } from "../model/claimed-rewards-groupBy-validation-pipe";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { PageDTO } from "../model/page-dto";
import { PageSizeDTO } from "../model/page-size-dto";
import { ClaimedRewardsSortValidationPipe, SortFieldClaimedRewardsDTO } from "../model/sort-field-claimed-rewards-dto";
import { SortOrderDTO, SortOrderValidationPipe } from "../model/sort-order-dto";

@ApiTags('Rewards')

@Controller('rewards')
export class RewardsController {
    constructor(private readonly _rewardsService: RewardsService) { }
    logger: Logger = new Logger(RewardsController.name);


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'whoClaimed', type: String, required: false, description: 'Address that actually performed the claim.' })
    @ApiQuery({ name: 'dataProvider', type: String, required: false, description: 'Address of the data provider that accrued the reward.' })
    @ApiQuery({ name: 'sentTo', type: String, required: false, description: 'Address that received the reward.' })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldClaimedRewardsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(RewardDTO, 'Returns a list of claimed rewards for the specified address')
    @ApiHeader({
        name: 'requestId',
        description: 'A custom header field that allows tracking the progress of the request. If you pass a `requestId` in the request header, you can track the progress of the API call by connecting to the WebSocket at `ws://%FLARE_BASE_URL%/progress/${requestId}`.',
        required: false,
    })
    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getClaimedRewards/:network")
    async getRewards(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('whoClaimed', AddressValidationPipe) whoClaimed: string,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('sentTo', AddressValidationPipe) sentTo: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', ClaimedRewardsSortValidationPipe) sortField: ClaimedRewardsSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req: Request,
        @Res() res

    ): Promise<ActionResult<PaginatedResult<RewardDTO[]>>> {
        return new Promise<ActionResult<PaginatedResult<RewardDTO[]>>>(async resolve => {
            const outputFormat = req.headers['accept'];
            let actionResult: ActionResult<PaginatedResult<RewardDTO[]>> = new ActionResult<PaginatedResult<RewardDTO[]>>();
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const requestId = headers['request_id'];

                const claimedRewards: PaginatedResult<RewardDTO[]> = await this._rewardsService.getRewardsDto(network, whoClaimed, dataProvider, sentTo, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!, requestId);
                actionResult.status = 'OK';
                actionResult.result = claimedRewards;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(claimedRewards.results);
                    resolve((res as any).status(HttpStatus.OK).send(csvData));
                }
            } catch (err) {
                actionResult.status = 'KO';
                actionResult.duration = new Date().getTime() - actionResult.start;
                actionResult.message = err.message;
                resolve((res).status(HttpStatus.INTERNAL_SERVER_ERROR).json(actionResult));

            }
        });
    }


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'whoClaimed', type: String, required: false, description: 'Address that actually performed the claim.' })
    @ApiQuery({ name: 'dataProvider', type: String, required: false, description: 'Address of the data provider that accrued the reward.' })
    @ApiQuery({ name: 'groupBy', type: ClaimedRewardsGroupByDTO, required: false, description: 'Specifies whether to aggregate by claimTimestamp or rewardEpochId.' })
    @ApiQuery({ name: 'aggregationInterval', type: AggregationIntervalDTO, required: false, description: 'Specifies whether to aggregate by claimTimestamp or rewardEpochId.' })

    @ApiActionResult(ClaimedRewardHistogramElement, 'The function returns a histogram that presents statistical data regarding claimed rewards, categorized either by reward epoch ID or claim timestamp. Additionally, if a \'whoClaimed\' address is provided, the results will also be grouped by the address of the data provider.')

    @Get("/getClaimedRewardsHistogram/:network")
    async getClaimedRewardsDateHistogram(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('whoClaimed', AddressValidationPipe) whoClaimed: string,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('groupBy', ClaimedRewardsGroupByValidationPipe) groupBy: ClaimedRewardsGroupByEnum,
        @Query('aggregationInterval', AggregationIntervalValidationPipe) aggregationInterval: string,
        @Res() res
    ): Promise<ActionResult<ClaimedRewardHistogramElement[]>> {
        return new Promise<ActionResult<ClaimedRewardHistogramElement[]>>(async resolve => {
            let actionResult: ActionResult<ClaimedRewardHistogramElement[]> = new ActionResult<ClaimedRewardHistogramElement[]>();
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const claimedRewardDateHistogramElements: ClaimedRewardHistogramElement[] = await this._rewardsService.getClaimedRewardsHistogram(network, whoClaimed, dataProvider, startTime, endTime, groupBy, aggregationInterval);
                actionResult.status = 'OK';
                actionResult.result = claimedRewardDateHistogramElements;
                actionResult.duration = new Date().getTime() - actionResult.start;
                resolve((res).status(HttpStatus.OK).json(actionResult));

            } catch (err) {
                actionResult.status = 'KO';
                actionResult.duration = new Date().getTime() - actionResult.start;
                actionResult.message = err.message;
                resolve((res).status(HttpStatus.INTERNAL_SERVER_ERROR).json(actionResult));

            }
        });
    }
}

