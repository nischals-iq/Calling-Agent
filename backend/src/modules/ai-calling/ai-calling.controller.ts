import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { CallJobsService } from './call-jobs.service.js';

@Controller('client/ai-calling')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AiCallingController {
  constructor(private readonly callJobsService: CallJobsService) {}

  /**
   * GET /api/client/ai-calling/jobs
   * Retrieves all AI call jobs for the authenticated client tenant
   */
  @Get('jobs')
  async getCallJobs(@CurrentTenant() tenantId: string) {
    return this.callJobsService.getTenantCallJobs(tenantId);
  }
}
