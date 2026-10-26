import { Module } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service.js';
import { AdminUsersController } from './admin-users.controller.js';

@Module({
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
