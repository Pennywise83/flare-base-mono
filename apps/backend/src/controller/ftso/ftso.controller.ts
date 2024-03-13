import { ActionResult, Commons, DataProviderExtendedInfo, DataProviderInfo, NetworkEnum, PaginatedResult, PriceFinalized, PriceFinalizedSortEnum } from "@flare-base/commons";
import { Controller, Get, Headers, HttpStatus, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { isEmpty } from "class-validator";
import { ApiActionResult } from "libs/commons/src/model/action-result";
import { ApiPaginatedResult, SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { FtsoService } from "../../service/ftso/ftso.service";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { PageDTO } from "../model/page-dto";
import { PageSizeDTO } from "../model/page-size-dto";
import { PriceFinalizedSortValidationPipe, SortFieldPriceFinalizedDTO } from "../model/sort-field-price-finalized-dto";
import { SortOrderDTO, SortOrderValidationPipe } from "../model/sort-order-dto";

@ApiTags('Ftso')
@Controller('ftso')
export class FtsoController {
    constructor(
        private readonly _ftsoService: FtsoService) { }


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiActionResult(DataProviderInfo, 'Returns data providers basic info')
    @Get("/getDataProvidersInfo/:network")
    async getDataProvidersInfo(
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Res() res
    ): Promise<ActionResult<DataProviderInfo[]>> {
        let actionResult: ActionResult<DataProviderInfo[]> = new ActionResult<DataProviderInfo[]>();
        return new Promise<ActionResult<DataProviderInfo[]>>(async (resolve, reject) => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                let result: DataProviderInfo[] = await this._ftsoService.getDataProvidersInfo(network);
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
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldPriceFinalizedDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(PriceFinalized, 'Returns a list of finalized prices for the specified symbol')

    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getFinalizedPrices/:network")
    async getDelegations(
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

    ): Promise<ActionResult<PaginatedResult<PriceFinalized[]>>> {
        let actionResult: ActionResult<PaginatedResult<PriceFinalized[]>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<PriceFinalized[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const requestId = headers['request_id'];
                const paginatedResults: PaginatedResult<PriceFinalized[]> = await this._ftsoService.getFinalizedPricesDto(network, symbol, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!, requestId)
                actionResult.status = 'OK';
                actionResult.result = paginatedResults;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
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
}
