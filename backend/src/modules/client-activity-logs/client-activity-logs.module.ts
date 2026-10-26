import { Module } from '@nestjs/common';
import { ClientActivityLogsController } from './client-activity-logs.controller.js';
import { ClientActivityLogsService } from './client-activity-logs.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ClientActivityLogsController],
  providers: [ClientActivityLogsService],
  exports: [ClientActivityLogsService],
})
export class ClientActivityLogsModule {}
