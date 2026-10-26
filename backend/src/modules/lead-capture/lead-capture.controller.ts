import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { LeadCaptureService } from './lead-capture.service.js';
import { CreateManualLeadDto } from './dto/manual-lead.dto.js';
import { PreviewCsvImportDto, ConfirmCsvImportDto } from './dto/csv-import.dto.js';
import { PublicLeadCaptureDto } from './dto/public-lead-capture.dto.js';
import { LeadQueryDto } from './dto/lead-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';

@Controller()
export class LeadCaptureController {
  constructor(private readonly leadCaptureService: LeadCaptureService) {}

  // ---------------------------------------------------------------------------
  // PUBLIC INTAKE ENDPOINT (Website forms, Landing pages, API submissions)
  // ---------------------------------------------------------------------------
  @Post('public/leads/capture')
  capturePublicLead(
    @Body() dto: PublicLeadCaptureDto,
    @Headers('x-tenant-key') headerKey1: string | undefined,
    @Headers('x-client-key') headerKey2: string | undefined,
    @Ip() ipAddress: string,
  ) {
    const key = headerKey1 || headerKey2;
    return this.leadCaptureService.ingestPublicLead(dto, key, ipAddress);
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATED CLIENT CRM ENDPOINTS
  // ---------------------------------------------------------------------------
  @Get('client/leads')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:view')
  getLeads(
    @CurrentTenant() tenantId: string,
    @Query() query: LeadQueryDto,
  ) {
    return this.leadCaptureService.getLeads(tenantId, query);
  }

  @Get('client/leads/config')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:view')
  getCaptureConfig(@CurrentTenant() tenantId: string) {
    return this.leadCaptureService.getCaptureConfig(tenantId);
  }

  @Post('client/leads/config/rotate-key')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:create')
  rotateApiKey(@CurrentTenant() tenantId: string) {
    return this.leadCaptureService.rotateApiKey(tenantId);
  }

  @Post('client/leads/manual')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:create')
  createManualLead(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateManualLeadDto,
    @Ip() ipAddress: string,
  ) {
    return this.leadCaptureService.createManualLead(tenantId, user.id, dto, ipAddress);
  }

  @Post('client/leads/import/preview')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:create')
  previewCsv(
    @CurrentTenant() tenantId: string,
    @Body() dto: PreviewCsvImportDto,
  ) {
    return this.leadCaptureService.previewCsv(tenantId, dto);
  }

  @Post('client/leads/import/confirm')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:create')
  confirmCsvImport(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmCsvImportDto,
    @Ip() ipAddress: string,
  ) {
    return this.leadCaptureService.confirmCsvImport(tenantId, user.id, dto, ipAddress);
  }

  @Get('client/leads/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:view')
  getLeadById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.leadCaptureService.getLeadById(id, tenantId);
  }

  @Patch('client/leads/:id/notes')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions('leads:edit')
  updateLeadNotes(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body('notes') notes: string,
  ) {
    return this.leadCaptureService.updateLeadNotes(id, tenantId, notes);
  }
}
