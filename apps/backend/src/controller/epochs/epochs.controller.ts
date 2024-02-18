import { ActionResult, Balance, WrappedBalance, Commons, PaginatedResult, PriceEpochDTO, PriceEpochSettings, RewardEpochDTO, RewardEpochSettings, SortOrderEnum, VotePowerDTO, VotePowerSortEnum } from "@flare-base/commons";
import { Controller, Get, HttpStatus, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiParam, ApiProduces, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ValidationError, isEmpty, validateSync } from "class-validator";
import { ApiActionResult } from "libs/commons/src/model/action-result";
import { NetworkEnum } from "libs/commons/src/model/blockchain";
import { EpochSortEnum } from "libs/commons/src/model/epochs/price-epoch";
import { ApiPaginatedResult } from "libs/commons/src/model/paginated-result";
import { EpochsService } from "../../service/epochs/epochs.service";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { PageDTO } from "../model/page-dto";
import { PageSizeDTO } from "../model/page-size-dto";
import { EpochsSortValidationPipe, SortFieldEpochsDTO } from "../model/sort-field-epochs";
import { SortOrderDTO, SortOrderValidationPipe } from "../model/sort-order-dto";
import { ClassConstructor, classToPlain, plainToClass } from "class-transformer";
import { BalancesService } from "../../service/balances/balances.service";
import { AddressValidationPipe } from "../model/address-validation-pipe";
import { DelegationsService } from "../../service/delegations/delegations.service";


@ApiTags('Epochs')
@Controller('epochs')
export class EpochsController {
    constructor(
        private readonly _epochsService: EpochsService,
        private readonly _balancesService: BalancesService,
        private readonly _delegationsService: DelegationsService
    ) { }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiActionResult(RewardEpochDTO, 'Retrieves the price epochs settings of the selected Network.')
    @Get("/getPriceEpochSettings/:network")
    async getPriceEpochSettings(@Param('network') network: NetworkEnum, @Res() res: Response): Promise<ActionResult<PriceEpochSettings>> {
        let ar: ActionResult<PriceEpochSettings> = new ActionResult();
        return new Promise<ActionResult<PriceEpochSettings>>(async resolve => {
            try {
                ar.result = await this._epochsService.getPriceEpochSettings(network);
                ar.status = 'OK';
                ar.duration = new Date().getTime() - ar.start;
                resolve((res as any).status(HttpStatus.OK).json(ar));
            } catch (err) {
                ar.status = 'KO';
                ar.duration = new Date().getTime() - ar.start;
                ar.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(ar));
            }
        });
    }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiActionResult(RewardEpochDTO, 'Retrieves the price epochs settings of the selected Network.')
    @Get("/getRewardEpochSettings/:network")
    async getRewardEpochSettings(@Param('network') network: NetworkEnum, @Res() res: Response): Promise<ActionResult<RewardEpochSettings>> {
        let ar: ActionResult<RewardEpochSettings> = new ActionResult();
        return new Promise<ActionResult<RewardEpochSettings>>(async resolve => {
            try {
                ar.result = await this._epochsService.getRewardEpochSettings(network);
                ar.status = 'OK';
                ar.duration = new Date().getTime() - ar.start;
                resolve((res as any).status(HttpStatus.OK).json(ar));
            } catch (err) {
                ar.status = 'KO';
                ar.duration = new Date().getTime() - ar.start;
                ar.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(ar));
            }
        });
    }


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldEpochsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(RewardEpochDTO, 'Returns a list of reward epochs in the selected timerange')

    @ApiProduces('application/json')
    @ApiProduces('text/csv')
    @Get("/getRewardEpochs/:network")
    async getRewardEpochs(
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', EpochsSortValidationPipe) sortField: EpochSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Res() res: Response,
        @Req() req: Request
    ): Promise<ActionResult<PaginatedResult<RewardEpochDTO[]>>> {
        let actionResult: ActionResult<PaginatedResult<RewardEpochDTO[]>> = new ActionResult<PaginatedResult<RewardEpochDTO[]>>();
        return new Promise<ActionResult<PaginatedResult<RewardEpochDTO[]>>>(async (resolve, reject) => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const outputFormat = req.headers['accept'];
                let result: PaginatedResult<RewardEpochDTO[]> = await this._epochsService.getRewardEpochsDto(network, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!);
                actionResult.status = 'OK';
                actionResult.result = result;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res as any).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(result.results);
                    resolve((res as any).status(HttpStatus.OK).send(csvData));
                }
            } catch (err) {
                actionResult.status = 'KO';
                actionResult.duration = new Date().getTime() - actionResult.start;
                actionResult.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(actionResult));
            }
        });
    }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'rewardEpochId', description: 'The unique identifier for the reward epoch', type: Number, required: true })
    @ApiActionResult(RewardEpochDTO, 'Retrieves information about the specified reward epoch.')
    @Get("/getRewardEpoch/:network")
    async getRewardEpoch(
        @Param('network') network: NetworkEnum,
        @Query('rewardEpochId', ParseIntPipe) rewardEpochId: number,
        @Res() res: Response
    ): Promise<ActionResult<RewardEpochDTO>> {
        let actionResult: ActionResult<RewardEpochDTO> = new ActionResult<RewardEpochDTO>();
        return new Promise<ActionResult<RewardEpochDTO>>(async (resolve, reject) => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                let result: RewardEpochDTO = await this._epochsService.getRewardEpochDto(network, rewardEpochId);
                actionResult.status = 'OK';
                actionResult.result = result;
                actionResult.duration = new Date().getTime() - actionResult.start;
                resolve((res as any).status(HttpStatus.OK).json(actionResult));
            } catch (err) {
                actionResult.status = 'KO';
                actionResult.duration = new Date().getTime() - actionResult.start;
                actionResult.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(actionResult));
            }
        });
    }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiActionResult(RewardEpochDTO, 'Retrieves information about the current reward epoch.')
    @Get("/getCurrentRewardEpoch/:network")
    async getCurrentRewardEpoch(@Param('network') network: NetworkEnum, @Res() res: Response): Promise<ActionResult<RewardEpochDTO>> {
        let ar: ActionResult<RewardEpochDTO> = new ActionResult();
        return new Promise<ActionResult<RewardEpochDTO>>(async resolve => {
            try {
                ar.result = await this._epochsService.getCurrentRewardEpochDto(network);
                ar.status = 'OK';
                ar.duration = new Date().getTime() - ar.start;
                resolve((res as any).status(HttpStatus.OK).json(ar));
            } catch (err) {
                ar.status = 'KO';
                ar.duration = new Date().getTime() - ar.start;
                ar.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(ar));
            }
        });
    }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldEpochsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(PriceEpochDTO, 'Returns a list of price epochs in the selected timerange')
    @ApiProduces('application/json')
    @ApiProduces('text/csv')
    @Get("/getPriceEpochs/:network")
    async getPriceEpochs(
        @Param('network') network: NetworkEnum,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', EpochsSortValidationPipe) sortField: EpochSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req: Request,
        @Res() res
    ): Promise<ActionResult<PaginatedResult<PriceEpochDTO[]>>> {
        let actionResult: ActionResult<PaginatedResult<PriceEpochDTO[]>> = new ActionResult<PaginatedResult<PriceEpochDTO[]>>();
        return new Promise<ActionResult<PaginatedResult<PriceEpochDTO[]>>>(async (resolve, reject) => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const outputFormat = req.headers['accept'];
                actionResult.status = 'OK';
                actionResult.result = await this._epochsService.getPriceEpochsDto(network, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!);
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(actionResult.result.results);
                    resolve((res as any).status(HttpStatus.OK).send(csvData));
                }
            } catch (err) {
                actionResult.status = 'KO';
                actionResult.duration = new Date().getTime() - actionResult.start;
                actionResult.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(actionResult));
            }
        });
    }

    @ApiResponse({ status: 200, description: 'Retrieves information about the specified price epoch.', type: PriceEpochDTO })
    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @Get("/getPriceEpoch/:network")
    async getPriceEpoch(
        @Param('network') network: NetworkEnum,
        @Query('priceEpochId', ParseIntPipe) priceEpochId: number,
        @Res() res: Response
    ): Promise<ActionResult<PriceEpochDTO>> {
        let actionResult: ActionResult<PriceEpochDTO> = new ActionResult<PriceEpochDTO>();
        return new Promise<ActionResult<PriceEpochDTO>>(async (resolve, reject) => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const result: PriceEpochDTO = await this._epochsService.getPriceEpochDto(network, priceEpochId);
                actionResult.status = 'OK';
                actionResult.result = result;
                actionResult.duration = new Date().getTime() - actionResult.start;
                resolve((res as any).status(HttpStatus.OK).json(actionResult));
            } catch (err) {
                actionResult.status = 'KO';
                actionResult.duration = new Date().getTime() - actionResult.start;
                actionResult.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(actionResult));
            }
        });
    }

    @ApiResponse({ status: 200, description: 'Returns the last finalized price epoch', type: PriceEpochDTO, isArray: true })
    @Get("/getCurrentPriceEpoch/:network")
    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @Get("/getCurrentPriceEpoch/:network")
    async getCurrentPriceEpoch(@Param('network') network: NetworkEnum, @Res() res: Response): Promise<ActionResult<PriceEpochDTO>> {
        let ar: ActionResult<PriceEpochDTO> = new ActionResult();
        return new Promise<ActionResult<PriceEpochDTO>>(async resolve => {
            try {
                ar.result = await this._epochsService.getCurrentPriceEpochDto(network);
                ar.status = 'OK';
                ar.duration = new Date().getTime() - ar.start;
                resolve((res as any).status(HttpStatus.OK).json(ar));
            } catch (err) {
                ar.status = 'KO';
                ar.duration = new Date().getTime() - ar.start;
                ar.message = err.message;
                resolve((res as any).status(HttpStatus.INTERNAL_SERVER_ERROR).json(ar));
            }
        });
    }
}
