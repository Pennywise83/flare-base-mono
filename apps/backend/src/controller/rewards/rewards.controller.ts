import { ActionResult, ClaimedRewardDateHistogramElement, ClaimedRewardsSortEnum, Commons, NetworkEnum, PaginatedResult, RewardDTO, SortOrderEnum } from "@flare-base/commons";
import { Controller, Get, Headers, HttpStatus, Logger, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiHeader, ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { isEmpty } from "class-validator";
import { ApiActionResult } from "libs/commons/src/model/action-result";
import { ApiPaginatedResult } from "libs/commons/src/model/paginated-result";
import { RewardsService } from "../../service/rewards/rewards.service";
import { AddressValidationPipe } from "../model/address-validation-pipe";
import { DateHistogramPointsDTO, DateHistogramPointsValidationPipe } from "../model/date-histogram-points";
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
    @ApiQuery({ name: 'dateHistogramPoints', type: DateHistogramPointsDTO, required: false, description: 'Number of points for the date histogram chart.' })
    @ApiActionResult(ClaimedRewardDateHistogramElement, 'Returns a date histogram based on claim timestamp, representing the statistical information regarding rewards claimed divided by reward epoch, claimer address and data provider address.')
    @Get("/getClaimedRewardsDateHistogram/:network")
    async getClaimedRewardsDateHistogram(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('whoClaimed', AddressValidationPipe) whoClaimed: string,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('dateHistogramPoints', DateHistogramPointsValidationPipe) dateHistogramPoints: number,
        @Res() res
    ): Promise<ActionResult<ClaimedRewardDateHistogramElement[]>> {
        return new Promise<ActionResult<ClaimedRewardDateHistogramElement[]>>(async resolve => {
            let actionResult: ActionResult<ClaimedRewardDateHistogramElement[]> = new ActionResult<ClaimedRewardDateHistogramElement[]>();
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const claimedRewardDateHistogramElements: ClaimedRewardDateHistogramElement[] = await this._rewardsService.getClaimedRewardsDateHistogram(network, whoClaimed, dataProvider, startTime, endTime, dateHistogramPoints);
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

