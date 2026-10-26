import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClientRolesService } from './client-roles.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';

@Controller('client/roles')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClientRolesController {
  constructor(private readonly rolesService: ClientRolesService) {}

  @Get()
  getRoles() {
    return this.rolesService.getRoles();
  }

  @Get('matrix')
  getMatrix() {
    return this.rolesService.getPermissionMatrix();
  }
}
