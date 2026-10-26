import { Injectable, Logger } from '@nestjs/common';
import { CallEligibilityService, EligibilityResult } from './call-eligibility.service.js';
import { CallJobsService } from './call-jobs.service.js';
import { AiCallJob } from '@prisma/client';

@Injectable()
export class AiCallingService {
  private readonly logger = new Logger(AiCallingService.name);

  constructor(
    private readonly eligibilityService: CallEligibilityService,
    private readonly callJobsService: CallJobsService,
  ) {}

  /**
   * Evaluates eligibility for an existing lead on demand
   */
  async checkLeadEligibility(
    leadId: string,
    clientId: string,
  ): Promise<EligibilityResult> {
    const idempotencyKey = `manual-check:${leadId}`;
    return this.eligibilityService.evaluateEligibility(leadId, clientId, idempotencyKey);
  }

  /**
   * Retrieves pending call jobs for a tenant
   */
  async getCallJob(id: string, clientId: string): Promise<AiCallJob | null> {
    return this.callJobsService.getJobById(id, clientId);
  }

  /**
   * Lists all call jobs for a specific lead
   */
  async getLeadCallJobs(leadId: string, clientId: string): Promise<AiCallJob[]> {
    return this.callJobsService.getJobsByLead(leadId, clientId);
  }
}
