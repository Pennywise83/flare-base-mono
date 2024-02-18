import { ActionResult, Commons, DataProviderExtendedInfo, DataProviderInfo, NetworkEnum } from "@flare-base/commons";
import { Controller, Get, Headers, HttpStatus, Param, ParseIntPipe, Query, Req, Res } from "@nestjs/common";
import { ApiParam, ApiProduces, ApiQuery, ApiTags } from "@nestjs/swagger";
import { isEmpty } from "class-validator";
import { FtsoService } from "../../service/ftso/ftso.service";
import { NetworkValidationPipe } from "../model/network-validation-pipe";
import { ApiActionResult } from "libs/commons/src/model/action-result";

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
}
