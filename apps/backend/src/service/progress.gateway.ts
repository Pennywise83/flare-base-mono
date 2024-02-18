import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@WebSocketGateway({ namespace: 'progress' })
export class ProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
    logger: Logger = new Logger(ProgressGateway.name);
    @WebSocketServer() server;
    async handleConnection(@ConnectedSocket() client: Socket) {
        this.logger.verbose(`A client has connected. Client ID: ${client.id}`);
    }

    async handleDisconnect(@ConnectedSocket() client: Socket) {
        this.logger.verbose(`A client has disconnected. Client ID: ${client.id}`);
        
    }
}