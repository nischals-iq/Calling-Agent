import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { ClientUsersService } from './client-users.service.js';
import {
  CreateClientUserDto,
  UpdateClientUserDto,
  ResetClientUserPasswordDto,
  ClientUserQueryDto,
} from './dto/client-user.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';

@Controller('client/users')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ClientUsersController {
  constructor(private readonly usersService: ClientUsersService) {}

  @Get()
  @RequirePermissions('users:view')
  getUsers(
    @CurrentTenant() tenantId: string,
    @Query() query: ClientUserQueryDto,
  ) {
    return this.usersService.getUsers(tenantId, query);
  }

  @Get(':id')
  @RequirePermissions('users:view')
  getUserById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.usersService.getUserById(id, tenantId);
  }

  @Post()
  @RequirePermissions('users:create')
  createUser(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientUserDto,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.createUser(tenantId, user.id, dto, ipAddress);
  }

  @Put(':id')
  @RequirePermissions('users:edit')
  updateUser(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientUserDto,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.updateUser(id, tenantId, user.id, dto, ipAddress);
  }

  @Patch(':id/status')
  @RequirePermissions('users:edit')
  toggleStatus(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('isActive') isActive: boolean,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.toggleUserStatus(id, tenantId, user.id, isActive, ipAddress);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users:edit')
  resetPassword(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResetClientUserPasswordDto,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.resetPassword(id, tenantId, user.id, dto, ipAddress);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  deleteUser(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.deleteUser(id, tenantId, user.id, ipAddress);
  }
}
