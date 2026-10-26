import { Module } from '@nestjs/common';
import { AdminClientsService } from './admin-clients.service.js';
import { AdminClientsController } from './admin-clients.controller.js';

@Module({
  controllers: [AdminClientsController],
  providers: [AdminClientsService],
  exports: [AdminClientsService],
})
export class AdminClientsModule {}
