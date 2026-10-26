import { Module } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';

@Module({
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule {}
