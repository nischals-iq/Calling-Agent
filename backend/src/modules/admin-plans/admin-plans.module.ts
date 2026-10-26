import { Global, Module } from '@nestjs/common';
import { AdminPlansService } from './admin-plans.service.js';
import { AdminPlansController } from './admin-plans.controller.js';

@Global()
@Module({
  controllers: [AdminPlansController],
  providers: [AdminPlansService],
  exports: [AdminPlansService],
})
export class AdminPlansModule {}
