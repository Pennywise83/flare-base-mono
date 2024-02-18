import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { auditLogger } from './audit-logger'; // Importa il tuo logger dedicato all'audit

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const controllerName = context.getClass().name;
        const methodName = context.getHandler().name;
        const start = Date.now();

        return next.handle().pipe(
            tap(() => {
                const end = Date.now();
                const responseTime = end - start;
                let status: string = 'OK';
                if (context.switchToHttp().getResponse().statusCode !== 200) {
                    status = 'KO';
                }
                // Qui puoi registrare le informazioni richieste o inviarle a un servizio di log
                auditLogger.info({
                    timestamp: start,
                    domain: controllerName,
                    method: methodName,
                    request: {
                        params: request.params,
                        query: request.query,
                        headers: request.headers,
                    },
                    status, // Puoi impostare questo in base al risultato della richiesta
                    responseTime: `${responseTime}`,
                });
            }),
        );
    }
}
