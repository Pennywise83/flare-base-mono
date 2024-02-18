import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { ActionResult } from '@flare-base/commons';

@Catch(BadRequestException)
export class CustomBadRequestFilter implements ExceptionFilter {
    catch(exception: BadRequestException, host: ArgumentsHost) {
        const context = host.switchToHttp();
        const response = context.getResponse<Response>();
        const request = context.getRequest<Request>();

        const status = HttpStatus.BAD_REQUEST;
        let errorResponse: ActionResult<any> = new ActionResult();
        errorResponse.status = 'KO';
        errorResponse.message = exception.message || 'Bad Request';
        errorResponse.duration = 0;

        response.status(status).json(errorResponse);
    }
}
