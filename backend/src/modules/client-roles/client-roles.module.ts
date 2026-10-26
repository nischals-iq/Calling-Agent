import { Module } from '@nestjs/common';
import { ClientRolesController } from './client-roles.controller.js';
import { ClientRolesService } from './client-roles.service.js';

@Module({
  controllers: [ClientRolesController],
  providers: [ClientRolesService],
  exports: [ClientRolesService],
})
export class ClientRolesModule {}
