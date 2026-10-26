import { Module } from '@nestjs/common';
import { ClientUsersController } from './client-users.controller.js';
import { ClientUsersService } from './client-users.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [PrismaModule, AuditLogsModule],
  controllers: [ClientUsersController],
  providers: [ClientUsersService],
  exports: [ClientUsersService],
})
export class ClientUsersModule {}
