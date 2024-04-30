import { ActionResult, Commons, DataProviderExtendedInfo, DataProviderInfo, DataProviderRewardStats, DataProviderRewardStatsGroupByEnum, FtsoFee, FtsoFeeSortEnum, HashSubmitted, HashSubmittedMatrix, HashSubmittedSortEnum, NetworkEnum, PaginatedResult, PriceFinalized, PriceFinalizedMatrix, PriceFinalizedSortEnum, PriceRevealed, PriceRevealedMatrix, PriceRevealedSortEnum, RealTimeFtsoData, RewardDistributed, RewardDistributedMatrix, RewardDistributedSortEnum } from "@flare-base/commons";
import { Controller, Get, Headers, HttpStatus, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { isEmpty } from "class-validator";
import { ApiActionResult } from "libs/commons/src/model/action-result";
import { DataProviderSubmissionStats } from "libs/commons/src/model/ftso/data-provider-submission-stats";
import { ApiPaginatedResult, SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { EpochsService } from "../../service/epochs/epochs.service";
import { FtsoService } from "../../service/ftso/ftso.service";
import { AddressValidationPipe } from "../model/address-validation-pipe";
import { MultipleAddressValidationPipe } from "../model/multiple-address-validation-pipe";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { PageDTO } from "../model/page-dto";
import { PageSizeDTO } from "../model/page-size-dto";
import { FtsoFeeSortValidationPipe, SortFieldFtsoFeeDTO } from "../model/sort-field-ftso-fee-dto";
import { HashSubmittedSortValidationPipe, SortFieldHashSubmittedDTO } from "../model/sort-field-hash-submitted-dto";
import { PriceFinalizedSortValidationPipe, SortFieldPriceFinalizedDTO } from "../model/sort-field-price-finalized-dto";
import { PriceRevealedSortValidationPipe, SortFieldPriceRevealedDTO } from "../model/sort-field-price-revealed-dto";
import { RewardDistributedSortValidationPipe, SortFieldRewardDistributedDTO } from "../model/sort-field-reward-distributed-dto";
import { RewardStatsSortValidationPipe, SortFieldRewardStatsDTO } from "../model/sort-field-reward-stats-dto";
import { SortOrderDTO, SortOrderValidationPipe } from "../model/sort-order-dto";

@ApiTags('Ftso')
@Controller('ftso')
export class FtsoController {
    constructor(
        private readonly _ftsoService: FtsoService,
        private readonly _epochService: EpochsService

    ) { }


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the price epoch id', type: Number, required: false })
    @ApiActionResult(DataProviderInfo, 'Returns data providers basic info')
    @Get("/getDataProvidersInfo/:network")
    async getDataProvidersInfo(
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('epochId', new ParseIntPipe({ optional: true })) epochId: number,
        @Res() res
    ): Promise<ActionResult<DataProviderInfo[]>> {
        let actionResult: ActionResult<DataProviderInfo[]> = new ActionResult<DataProviderInfo[]>();
        return new Promise<ActionResult<DataProviderInfo[]>>(async (resolve, reject) => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                let result: DataProviderInfo[] = await this._ftsoService.getDataProvidersInfo(network, epochId);
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
    @ApiActionResult(DataProviderExtendedInfo, 'Returns data providers extended info grouped by reward epochs')
    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getDataProvidersData/:network")
    async getDataProvidersData(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Req() req: Request,
        @Res() res?

    ): Promise<ActionResult<DataProviderExtendedInfo[]>> {
        let actionResult: ActionResult<DataProviderExtendedInfo[]> = new ActionResult();
        return new Promise<ActionResult<DataProviderExtendedInfo[]>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const outputFormat = req.headers['accept'];
                const result: DataProviderExtendedInfo[] = await this._ftsoService.getDataProvidersData(network, epochId);
                actionResult.status = 'OK';
                actionResult.result = result;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(result);
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
    @ApiQuery({ name: 'symbol', description: 'The FTSO symbol to which the price refers. Leave empty to fetch the prices for all symbols.', type: String, required: false })
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the price epoch id', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldPriceFinalizedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(PriceRevealed, 'Returns a list of finalized prices for the specified symbol at the provided price epoch')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiProduces('application/vnd.flare.base+json')
    @Get("/getFinalizedPricesByEpochId/:network")
    async getFinalizedPricesByEpochId(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('symbol') symbol: string,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', PriceRevealedSortValidationPipe) sortField: PriceFinalizedSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceFinalizedMatrix>>> {
        let actionResult: ActionResult<PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceFinalizedMatrix>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceFinalizedMatrix>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const paginatedResults: PaginatedResult<PriceFinalized[]> = await this._ftsoService.getFinalizedPricesByEpochId(network, symbol, epochId, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else if (outputFormat == 'application/vnd.flare.base+json') {
                    (actionResult as ActionResult<PaginatedResult<PriceFinalizedMatrix>>).result.results = new PriceFinalizedMatrix(paginatedResults.results);
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(paginatedResults.results);
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
    @ApiQuery({ name: 'symbol', description: 'The FTSO symbol to which the price refers. Leave empty to fetch the prices for all symbols.', type: String, required: false })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldPriceFinalizedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(PriceFinalized, 'Returns a list of finalized prices for the specified symbol at the provided time range')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiProduces('application/vnd.flare.base+json')
    @Get("/getFinalizedPrices/:network")
    async getFinalizedPrices(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('symbol') symbol: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', PriceFinalizedSortValidationPipe) sortField: PriceFinalizedSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceFinalizedMatrix>>> {
        let actionResult: ActionResult<PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceFinalizedMatrix>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<PriceFinalized[]> | PaginatedResult<PriceFinalizedMatrix>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const priceEpochSettings = await this._epochService.getPriceEpochSettings(network);
                startTime += - priceEpochSettings.priceEpochDurationMillis;
                const paginatedResults: PaginatedResult<PriceFinalized[]> = await this._ftsoService.getFinalizedPricesDto(network, symbol, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else if (outputFormat == 'application/vnd.flare.base+json') {
                    (actionResult as ActionResult<PaginatedResult<PriceFinalizedMatrix>>).result.results = new PriceFinalizedMatrix(paginatedResults.results);
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(paginatedResults.results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Address of the data provider. Leave empty to fetch the prices for all data providers.', type: String, required: false })
    @ApiQuery({ name: 'symbol', description: 'The FTSO symbol to which the price refers. Leave empty to fetch the prices for all symbols.', type: String, required: false })
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the price epoch id', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldPriceRevealedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(PriceRevealed, 'Returns a list of revealed prices for the specified data provider and symbol at the provided price epoch')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiProduces('application/vnd.flare.base+json')
    @Get("/getRevealedPricesByEpochId/:network")
    async getRevealedPricesByEpochId(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('symbol') symbol: string,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', PriceRevealedSortValidationPipe) sortField: PriceRevealedSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<PriceRevealed[]> | PaginatedResult<PriceRevealedMatrix>>> {
        let actionResult: ActionResult<PaginatedResult<PriceRevealed[]> | PaginatedResult<PriceRevealedMatrix>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<PriceRevealed[]> | PaginatedResult<PriceRevealedMatrix>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const paginatedResults: PaginatedResult<PriceRevealed[]> = await this._ftsoService.getRevealedPricesByEpochId(network, dataProvider, symbol, epochId, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else if (outputFormat == 'application/vnd.flare.base+json') {
                    (actionResult as ActionResult<PaginatedResult<PriceRevealedMatrix>>).result.results = new PriceRevealedMatrix(paginatedResults.results);
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(paginatedResults.results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Addresses of the data provider, comma separed. Leave empty to fetch the prices for all data providers.', type: String, required: false })
    @ApiQuery({ name: 'symbol', description: 'The FTSO symbol to which the price refers. Leave empty to fetch the prices for all symbols.', type: String, required: false })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldPriceRevealedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(PriceRevealed, 'Returns a list of revealed prices for the specified data provider and symbol at the provided time range')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiProduces('application/vnd.flare.base+json')
    @Get("/getRevealedPrices/:network")
    async getRevealedPrices(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', MultipleAddressValidationPipe) dataProvider: string,
        @Query('symbol') symbol: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', PriceRevealedSortValidationPipe) sortField: PriceRevealedSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<PriceRevealed[]> | PaginatedResult<PriceRevealedMatrix>>> {
        let actionResult: ActionResult<PaginatedResult<PriceRevealed[]> | PaginatedResult<PriceRevealedMatrix>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<PriceRevealed[]> | PaginatedResult<PriceRevealedMatrix>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const priceEpochSettings = await this._epochService.getPriceEpochSettings(network);
                startTime += - priceEpochSettings.priceEpochDurationMillis;
                const paginatedResults: PaginatedResult<PriceRevealed[]> = await this._ftsoService.getRevealedPricesDto(network, dataProvider, symbol, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else if (outputFormat == 'application/vnd.flare.base+json') {
                    (actionResult as ActionResult<PaginatedResult<PriceRevealedMatrix>>).result.results = new PriceRevealedMatrix(paginatedResults.results);
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(paginatedResults.results);
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
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the price epoch id', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldHashSubmittedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(HashSubmitted, 'Returns a list of submitted hashes for the provided price epoch')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiProduces('application/vnd.flare.base+json')
    @Get("/getSubmittedHashesByEpochId/:network")
    async getSubmittedHashesByEpochId(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', HashSubmittedSortValidationPipe) sortField: HashSubmittedSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<HashSubmitted[]> | PaginatedResult<HashSubmittedMatrix>>> {
        let actionResult: ActionResult<PaginatedResult<HashSubmitted[]> | PaginatedResult<HashSubmittedMatrix>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<HashSubmitted[]> | PaginatedResult<HashSubmittedMatrix>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const paginatedResults: PaginatedResult<HashSubmitted[]> = await this._ftsoService.getSubmittedHashesByEpochId(network, epochId, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else if (outputFormat == 'application/vnd.flare.base+json') {
                    (actionResult as ActionResult<PaginatedResult<HashSubmittedMatrix>>).result.results = new HashSubmittedMatrix(paginatedResults.results);
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(paginatedResults.results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Address of the data provider. Leave empty to fetch the prices for all data providers.', type: String, required: false })
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the price epoch id', type: Number, required: true })
    @ApiQuery({ name: 'sortField', type: SortFieldFtsoFeeDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(FtsoFee, 'Returns a list of ftso fees for the specified data provider at the provided price epoch.')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getFtsoFee/:network")
    async getFtsoFee(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('sortField', FtsoFeeSortValidationPipe) sortField: FtsoFeeSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<FtsoFee[]>>> {
        let actionResult: ActionResult<FtsoFee[]> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<FtsoFee[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const results: FtsoFee[] = await this._ftsoService.getFtsoFeeByRewardEpoch(network, epochId, dataProvider, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = results;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Address of the data provider.', type: String, required: true })
    @ApiPaginatedResult(FtsoFee, 'Returns the ftso fees history for the specified data provider')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getFtsoFeeHistory/:network")
    async getFtsoFeeHistory(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<FtsoFee[]>>> {
        let actionResult: ActionResult<FtsoFee[]> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<FtsoFee[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const results: FtsoFee[] = await this._ftsoService.getFtsoFeeHistory(network, dataProvider);
                actionResult.status = 'OK';
                actionResult.result = results;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Data provider address that accrued the reward for the given price epoch id. Leave empty to fetch the prices for all data providers.', type: String, required: false })
    @ApiQuery({ name: 'symbol', description: 'Symbol of the FTSO that generated the rewards. Leave empty to fetch the prices for all symbols.', type: String, required: false })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldRewardDistributedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(RewardDistributed, 'Returns a list of distributed rewards for the specified symbol and data provider at the provided time range.')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiProduces('application/vnd.flare.base+json')
    @Get("/getRewardsDistributed/:network")
    async getRewardsDistributed(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', MultipleAddressValidationPipe) dataProvider: string,
        @Query('symbol') symbol: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', RewardDistributedSortValidationPipe) sortField: RewardDistributedSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<RewardDistributed[]> | PaginatedResult<RewardDistributedMatrix>>> {
        let actionResult: ActionResult<PaginatedResult<RewardDistributed[]> | PaginatedResult<RewardDistributedMatrix>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<RewardDistributed[]> | PaginatedResult<RewardDistributedMatrix>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const paginatedResults: PaginatedResult<RewardDistributed[]> = await this._ftsoService.getRewardsDistributedDTO(network, dataProvider, symbol, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else if (outputFormat == 'application/vnd.flare.base+json') {
                    (actionResult as ActionResult<PaginatedResult<RewardDistributedMatrix>>).result.results = new RewardDistributedMatrix(paginatedResults.results);
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(paginatedResults.results);
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
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the reward epoch id', type: Number, required: true })
    @ApiQuery({ name: 'dataProvider', description: 'Data provider address that accrued the reward for the given price epoch id. Leave empty to fetch the data for all data providers.', type: String, required: false })
    @ApiActionResult(DataProviderRewardStats, 'Returns a the rewards stats for the provided reward epoch id, divided by data provider addresses.')
    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getDataProviderRewardStatsByRewardEpoch/:network")
    async getDataProviderRewardStatsByRewardEpoch(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<DataProviderRewardStats[]>>> {
        let actionResult: ActionResult<DataProviderRewardStats[]> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<DataProviderRewardStats[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const results: DataProviderRewardStats[] = await this._ftsoService.getDataProviderRewardStatsByRewardEpoch(network, dataProvider, epochId);
                actionResult.status = 'OK';
                actionResult.result = results;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Data provider address that accrued the reward for the given time range. Leave empty to fetch the data for all data providers.', type: String, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldRewardStatsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(DataProviderRewardStats, 'Retrieves the accrued Ftso rewards of the provided Data provider address grouped by reward epochs. Leave empty to retrieve the rewards accrued by all data providers.')
    @ApiProduces('application/json')
    @ApiProduces('text/csv')
    @Get("/getDataProviderRewardStatsHistory/:network")
    async getDataProviderRewardStatsHistory(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', RewardStatsSortValidationPipe) sortField: DataProviderRewardStatsGroupByEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<DataProviderRewardStats[]>>> {
        let actionResult: ActionResult<PaginatedResult<DataProviderRewardStats[]>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<DataProviderRewardStats[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const results: PaginatedResult<DataProviderRewardStats[]> = await this._ftsoService.getDataProviderRewardStatsHistory(network, dataProvider, startTime, endTime, page, pageSize, sortField, sortOrder);
                actionResult.status = 'OK';
                actionResult.result = results;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(results.results);
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
    @ApiQuery({ name: 'dataProvider', description: 'Data provider address on which to calculate the submission statistics for the given time range.Leave empty to fetch the data for all data providers.', type: String, required: false })
    @ApiQuery({ name: 'symbol', description: 'The FTSO symbol to which the submissions refers. Use `all` to include all symbols, leave empty to retrieve global statistics across all the symbols.', type: String, required: false })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiActionResult(DataProviderSubmissionStats, 'Returns a the submission stats for the specified data provider at the provided time range, divided by reward epoch.')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getDataProviderSubmissionStats/:network")
    async getDataProviderSubmissionStats(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('dataProvider', MultipleAddressValidationPipe) dataProvider: string,
        @Query('symbol') symbol: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<DataProviderSubmissionStats[]>> {
        let actionResult: ActionResult<DataProviderSubmissionStats[]> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<DataProviderSubmissionStats[]>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const priceEpochSettings = await this._epochService.getPriceEpochSettings(network); priceEpochSettings.getEpochIdForTime(startTime)
                startTime += - priceEpochSettings.priceEpochDurationMillis;
                const results: DataProviderSubmissionStats[] = await this._ftsoService.getDataProviderSubmissionStatsByDataProvider(network, dataProvider, symbol, startTime, endTime);
                actionResult.status = 'OK';
                actionResult.result = results;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(results);
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
    @ApiQuery({ name: 'epochId', description: 'The unique identifier for the reward epoch id', type: Number, required: true })
    @ApiQuery({ name: 'dataProvider', description: 'Data provider address on which to calculate the submission statistics for the given reward epoch id. Leave empty to fetch the data for all data providers.', type: String, required: false })
    @ApiQuery({ name: 'symbol', description: 'The FTSO symbol to which the submissions refers. Use `all` to include all symbols, leave empty to retrieve global statistics across all the symbols.', type: String, required: false })
    @ApiPaginatedResult(DataProviderSubmissionStats, 'Returns a the submission stats for the provided reward epoch id, divided by data provider addresses.')
    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getDataProviderSubmissionsStatsByRewardEpoch/:network")
    async getDataProviderSubmissionStatsByRewardEpoch(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('dataProvider', AddressValidationPipe) dataProvider: string,
        @Query('symbol') symbol: string,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<DataProviderSubmissionStats[]>>> {
        let actionResult: ActionResult<DataProviderSubmissionStats[]> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<DataProviderSubmissionStats[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const results: DataProviderSubmissionStats[] = await this._ftsoService.getDataProvideSubmissionStatsByRewardEpoch(network, epochId, dataProvider, symbol);
                actionResult.status = 'OK';
                actionResult.result = results;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv(results);
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
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiProduces('application/json')
    @Get("/getAvailableSymbols/:network")
    async getAvailableSymbols(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<string[]>> {
        let actionResult: ActionResult<string[]> = new ActionResult();
        return new Promise<ActionResult<string[]>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const results: string[] = await this._ftsoService.getAvailableSymbols(network, startTime, endTime);
                actionResult.status = 'OK';
                actionResult.result = results;
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


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiProduces('application/json')
    @Get("/getRealTimeFtsoData/:network")
    async getRealTimeFtsoData(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<RealTimeFtsoData>> {
        let actionResult: ActionResult<RealTimeFtsoData> = new ActionResult();
        return new Promise<ActionResult<RealTimeFtsoData>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const results: RealTimeFtsoData = await this._ftsoService.getRealTimeFtsoData(network);
                actionResult.status = 'OK';
                actionResult.result = results;
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
