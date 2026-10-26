import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { AdminClientsService } from './admin-clients.service.js';
import {
  CreateClientDto,
  UpdateClientDto,
  UpdateClientStatusDto,
  UpdateClientPlanDto,
  UpdateClientConfigDto,
} from './dto/client.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';
import { ClientStatus, SubscriptionPlan, UserRole } from '@prisma/client';

@Controller('admin/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminClientsController {
  constructor(private readonly clientsService: AdminClientsService) {}

  @Get()
  async getClients(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: ClientStatus,
    @Query('plan') plan?: SubscriptionPlan,
  ) {
    return this.clientsService.findAll({ page, limit, search, status, plan });
  }

  @Post()
  async createClient(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.clientsService.create(dto, user.id, ip);
  }

  @Get(':id')
  async getClientDetails(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  async updateClient(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.clientsService.update(id, dto, user.id, ip);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClientStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.clientsService.updateStatus(id, dto, user.id, ip);
  }

  @Patch(':id/plan')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdateClientPlanDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.clientsService.updatePlan(id, dto, user.id, ip);
  }

  @Patch(':id/config')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateClientConfigDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    return this.clientsService.updateConfig(id, dto, user.id, ip);
  }
}
