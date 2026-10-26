import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { ClientTeamsService } from './client-teams.service.js';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AssignTeamMembersDto,
} from './dto/client-team.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';

@Controller('client/teams')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ClientTeamsController {
  constructor(private readonly teamsService: ClientTeamsService) {}

  @Get()
  @RequirePermissions('teams:view')
  getTeams(@CurrentTenant() tenantId: string) {
    return this.teamsService.getTeams(tenantId);
  }

  @Get(':id')
  @RequirePermissions('teams:view')
  getTeamById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.teamsService.getTeamById(id, tenantId);
  }

  @Post()
  @RequirePermissions('teams:create')
  createTeam(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeamDto,
    @Ip() ipAddress: string,
  ) {
    return this.teamsService.createTeam(tenantId, user.id, dto, ipAddress);
  }

  @Put(':id')
  @RequirePermissions('teams:edit')
  updateTeam(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTeamDto,
    @Ip() ipAddress: string,
  ) {
    return this.teamsService.updateTeam(id, tenantId, user.id, dto, ipAddress);
  }

  @Patch(':id/status')
  @RequirePermissions('teams:edit')
  toggleStatus(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('isActive') isActive: boolean,
    @Ip() ipAddress: string,
  ) {
    return this.teamsService.toggleTeamStatus(id, tenantId, user.id, isActive, ipAddress);
  }

  @Post(':id/members')
  @RequirePermissions('teams:assign')
  assignMembers(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignTeamMembersDto,
    @Ip() ipAddress: string,
  ) {
    return this.teamsService.assignMembers(id, tenantId, user.id, dto, ipAddress);
  }

  @Delete(':id')
  @RequirePermissions('teams:delete')
  deleteTeam(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ipAddress: string,
  ) {
    return this.teamsService.deleteTeam(id, tenantId, user.id, ipAddress);
  }
}
