import { Module } from '@nestjs/common';
import { ClientDashboardController } from './client-dashboard.controller.js';
import { ClientDashboardService } from './client-dashboard.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ClientDashboardController],
  providers: [ClientDashboardService],
  exports: [ClientDashboardService],
})
export class ClientDashboardModule {}
