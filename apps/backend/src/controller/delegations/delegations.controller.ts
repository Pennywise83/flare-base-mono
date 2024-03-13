import { ActionResult, Commons, DelegationDTO, NetworkEnum } from "@flare-base/commons";
import { Controller, Get, Headers, HttpStatus, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiHeader, ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { isEmpty } from "class-validator";
import { DelegationsSortEnum } from "libs/commons/src/model/delegations/delegation";
import { ApiPaginatedResult, PaginatedResult, SortOrderEnum } from "libs/commons/src/model/paginated-result";
import { DelegationsService } from "../../service/delegations/delegations.service";
import { AddressValidationPipe } from "../model/address-validation-pipe";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { PageDTO } from "../model/page-dto";
import { PageSizeDTO } from "../model/page-size-dto";
import { DelegationsSortValidationPipe, SortFieldDelegationsDTO } from "../model/sort-field-delegations-dto";
import { SortOrderDTO, SortOrderValidationPipe } from "../model/sort-order-dto";



@ApiTags('Delegations')
@Controller('delegations')
export class DelegationsController {
    constructor(private readonly _delegationsService: DelegationsService) { }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'from', description: 'The address that delegated to the data provider. Leave empty to fetch the delegations of all delegators.', type: String, required: false })
    @ApiQuery({ name: 'to', description: 'The address of the data provider that received the delegations. Leave empty to fetch the delegations of all data providers', type: String, required: false })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldDelegationsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(DelegationDTO, 'Returns a list of delegations for the specified address')

    
    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @Get("/getDelegations/:network")
    async getDelegations(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('from', AddressValidationPipe) from: string,
        @Query('to', AddressValidationPipe) to: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', DelegationsSortValidationPipe) sortField: DelegationsSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req?,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<DelegationDTO[]>>> {
        let actionResult: ActionResult<PaginatedResult<DelegationDTO[]>> = new ActionResult();
        const outputFormat = req.headers['accept'];
        return new Promise<ActionResult<PaginatedResult<DelegationDTO[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const requestId = headers['request_id'];
                const paginatedResults: PaginatedResult<DelegationDTO[]> = await this._delegationsService.getDelegationsDto(network, from, to, startTime, endTime, page, pageSize, sortField!, SortOrderEnum[sortOrder]!, requestId)
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

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'address', description: 'The address of the data provider.', type: String, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldDelegationsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(DelegationDTO, 'Returns a list of the delegators for the specified data provider address')
    @ApiProduces('text/csv')
    @ApiProduces('application/json')
    @ApiHeader({
        name: 'requestId',
        description: 'A custom header field that allows tracking the progress of the request. If you pass a `requestId` in the request header, you can track the progress of the API call by connecting to the WebSocket at `ws://%FLARE_BASE_URL%/progress/${requestId}`.',
        required: false,
    })


    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldDelegationsDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @Get("/getDelegatorsAt/:network")
    async getDelegatorsAt(
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('address', AddressValidationPipe) address: string,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', DelegationsSortValidationPipe) sortField: DelegationsSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req,
        @Res() res


    ): Promise<ActionResult<PaginatedResult<DelegationDTO[]>>> {
        let actionResult: ActionResult<PaginatedResult<DelegationDTO[]>> = new ActionResult();
        return new Promise<ActionResult<PaginatedResult<DelegationDTO[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (epochId < 0) {
                    throw new Error(`Invalid reward epoch`);
                }
                const outputFormat = req.headers['accept'];
                const paginatedResults: PaginatedResult<DelegationDTO[]> = await this._delegationsService.getDelegators(network, address, epochId, page, pageSize, sortField!, SortOrderEnum[sortOrder]!)
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


