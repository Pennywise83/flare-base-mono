import { ActionResult, Commons, NetworkEnum, PaginatedResult, SortOrderEnum } from "@flare-base/commons";
import { InjectQueue, OnQueueCompleted } from "@nestjs/bull";
import { Controller, Get, Headers, HttpStatus, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Job, Queue } from "bull";
import { isEmpty } from "class-validator";
import { ApiActionResult } from "libs/commons/src/model/action-result";
import { ApiPaginatedResult } from "libs/commons/src/model/paginated-result";
import { VotePowerDTO, VotePowerSortEnum } from "libs/commons/src/model/votepower/votepower";
import { DelegationsService } from "../../service/delegations/delegations.service";
import { AddressValidationPipe } from "../model/address-validation-pipe";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { PageDTO } from "../model/page-dto";
import { PageSizeDTO } from "../model/page-size-dto";
import { SortFieldVotePowerDTO, VotePowerSortValidationPipe } from "../model/sort-field-votepower-dto";
import { SortOrderDTO, SortOrderValidationPipe } from "../model/sort-order-dto";



@ApiTags('Vote Power')
@Controller('votepower')
export class VotePowerController {
    constructor(private readonly _delegationsService: DelegationsService,
    ) { }

    @ApiParam({ name: "network", enum: NetworkEnum, enumName: "NetworkEnum", required: true })
    @ApiQuery({ name: 'address', description: 'Data provider address for fetching the corresponding Delegated Vote Power. Leave empty to get the Delegated Vote Power of all data providers.', type: String, required: false })
    @ApiActionResult(VotePowerDTO, 'Retrieves the vote power of the provided Data provider address at the provided reward epoch. Leave empty to retrieve the total delegated vote power.')
    @ApiProduces('application/json')
    @ApiProduces('text/csv')
    @Get("/getVotePower/:network")
    async getVotePower(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('address', AddressValidationPipe) address: string,
        @Query('epochId', ParseIntPipe) epochId: number,
        @Req() req: Request,
        @Res() res?

    ): Promise<ActionResult<VotePowerDTO>> {
        let actionResult: ActionResult<VotePowerDTO> = new ActionResult();
        return new Promise<ActionResult<VotePowerDTO>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                const outputFormat = req.headers['accept'];
                const result: VotePowerDTO = await this._delegationsService.getVotePower(network, address, epochId);

                actionResult.status = 'OK';
                actionResult.result = result;
                actionResult.duration = new Date().getTime() - actionResult.start;
                if (outputFormat == 'application/json') {
                    resolve((res).status(HttpStatus.OK).json(actionResult));
                } else {
                    let csvData = Commons.objectsToCsv([result]);
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
    @ApiQuery({ name: 'address', description: 'Data provider address for fetching the corresponding Delegated Vote Power history. Leave empty to get data of all data providers.', type: String, required: false })
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldVotePowerDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(VotePowerDTO, 'Retrieves the delegated vote power history of the provided Data provider address grouped by reward epochs. Leave empty to retrieve the total data providers delegated vote power.')
    @ApiProduces('application/json')
    @ApiProduces('text/csv')
    @Get("/getDelegatedVotePowerHistory/:network")
    async getDelegatedVotePowerHistory(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('address', AddressValidationPipe) address: string,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', VotePowerSortValidationPipe) sortField: VotePowerSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req: Request,
        @Res() res?,


    ): Promise<ActionResult<PaginatedResult<VotePowerDTO[]>>> {
        let actionResult: ActionResult<PaginatedResult<VotePowerDTO[]>> = new ActionResult();
        return new Promise<ActionResult<PaginatedResult<VotePowerDTO[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const outputFormat = req.headers['accept'];
                const paginatedResults: PaginatedResult<VotePowerDTO[]> = await this._delegationsService.getDelegatedVotePowerHistory(network, address, startTime, endTime, page, pageSize, sortField, sortOrder);
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
    @ApiQuery({ name: 'startTime', description: 'The start time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'endTime', description: 'The end time of the time range (Unix timestamp in milliseconds).', type: Number, required: true })
    @ApiQuery({ name: 'page', type: PageDTO })
    @ApiQuery({ name: 'pageSize', type: PageSizeDTO })
    @ApiQuery({ name: 'sortField', type: SortFieldVotePowerDTO })
    @ApiQuery({ name: 'sortOrder', type: SortOrderDTO })
    @ApiPaginatedResult(VotePowerDTO, 'Retrieves the total vote power history (delegated and not) grouped by reward epochs.')
    @ApiProduces('application/json')
    @ApiProduces('text/csv')
    @Get("/getTotalVotePowerHistory/:network")
    async getTotalVotePowerHistory(
        @Headers() headers,
        @Param('network', NetworkValidationPipe) network: NetworkEnum,
        @Query('startTime', ParseIntPipe) startTime: number,
        @Query('endTime', ParseIntPipe) endTime: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('pageSize', ParseIntPipe) pageSize: number,
        @Query('sortField', VotePowerSortValidationPipe) sortField: VotePowerSortEnum,
        @Query('sortOrder', SortOrderValidationPipe,) sortOrder: SortOrderEnum,
        @Req() req: Request,
        @Res() res?

    ): Promise<ActionResult<PaginatedResult<VotePowerDTO[]>>> {
        let actionResult: ActionResult<PaginatedResult<VotePowerDTO[]>> = new ActionResult();
        return new Promise<ActionResult<PaginatedResult<VotePowerDTO[]>>>(async resolve => {
            try {
                if (isEmpty(network)) {
                    throw new Error(`Network could not be empty`);
                }
                if (startTime > endTime) {
                    throw new Error(`Wrong time range`);
                }
                const outputFormat = req.headers['accept'];
                const paginatedResults: PaginatedResult<VotePowerDTO[]> = await this._delegationsService.getTotalVotePowerHistory(network, startTime, endTime, page, pageSize, sortField, sortOrder);
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