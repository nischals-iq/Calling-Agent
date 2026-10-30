import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiCallJob, CallJobPriority, CallJobStatus } from '@prisma/client';

export interface CreateCallJobDto {
  leadId: string;
  clientId: string;
  idempotencyKey: string;
  priority?: CallJobPriority;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class CallJobsService {
  private readonly logger = new Logger(CallJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates an AI Call Job in PENDING status.
   * Guarantees idempotency via unique idempotencyKey.
   */
  async createCallJob(data: CreateCallJobDto): Promise<AiCallJob> {
    const priority = data.priority || CallJobPriority.HIGH;
    const scheduledAt = data.scheduledAt || new Date();

    try {
      const job = await this.prisma.aiCallJob.create({
        data: {
          leadId: data.leadId,
          clientId: data.clientId,
          status: CallJobStatus.PENDING,
          priority,
          scheduledAt,
          attemptNumber: 0,
          idempotencyKey: data.idempotencyKey,
          metadata: data.metadata ? (data.metadata as any) : undefined,
        },
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              source: true,
            },
          },
        },
      });

      this.logger.log(
        `Created AI call job ${job.id} for lead ${data.leadId} (idempotencyKey: ${data.idempotencyKey})`,
      );
      return job;
    } catch (err: any) {
      // Prisma unique constraint violation code is P2002
      if (err.code === 'P2002') {
        this.logger.warn(
          `Idempotency conflict: Call job with idempotencyKey "${data.idempotencyKey}" already exists`,
        );
        const existingJob = await this.prisma.aiCallJob.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (existingJob) {
          return existingJob;
        }
        throw new ConflictException(
          `Duplicate call job detected for idempotency key ${data.idempotencyKey}`,
        );
      }
      this.logger.error(`Error creating call job: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Retrieves a call job by its primary ID, scoped to tenant
   */
  async getJobById(id: string, clientId: string): Promise<AiCallJob | null> {
    return this.prisma.aiCallJob.findFirst({
      where: { id, clientId },
      include: {
        lead: true,
      },
    });
  }

  /**
   * Retrieves a call job by its unique idempotency key
   */
  async getJobByIdempotencyKey(idempotencyKey: string): Promise<AiCallJob | null> {
    return this.prisma.aiCallJob.findUnique({
      where: { idempotencyKey },
      include: {
        lead: true,
      },
    });
  }

  /**
   * Lists all call jobs for a given lead
   */
  async getJobsByLead(leadId: string, clientId: string): Promise<AiCallJob[]> {
    return this.prisma.aiCallJob.findMany({
      where: { leadId, clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Checks if an active call job exists for a lead
   */
  async findActiveJobForLead(leadId: string, clientId: string): Promise<AiCallJob | null> {
    return this.prisma.aiCallJob.findFirst({
      where: {
        leadId,
        clientId,
        status: {
          in: [
            CallJobStatus.PENDING,
            CallJobStatus.QUEUED,
            CallJobStatus.IN_PROGRESS,
          ],
        },
      },
    });
  }

  /**
   * Lists all call jobs for the authenticated tenant with lead context
   */
  async getTenantCallJobs(clientId: string) {
    const jobs = await this.prisma.aiCallJob.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            source: true,
          },
        },
        sessions: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            provider: true,
            providerCallId: true,
            status: true,
            outcome: true,
            durationSeconds: true,
            recordingReference: true,
            failureReason: true,
            startedAt: true,
            connectedAt: true,
            endedAt: true,
            metadata: true,
          },
        },
      },
    });

    return jobs.map((job) => {
      const latest = job.sessions?.[0] || null;
      return {
        id: job.id,
        leadId: job.leadId,
        leadName: `${job.lead?.firstName || ''} ${job.lead?.lastName || ''}`.trim() || 'Unknown Lead',
        phone: job.lead?.phone || '—',
        source: job.lead?.source || '—',
        status: job.status,
        priority: job.priority,
        attemptNumber: job.attemptNumber,
        scheduledAt: job.scheduledAt,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        failedAt: job.failedAt,
        lastError: job.lastError,
        metadata: job.metadata,
        createdAt: job.createdAt,
        latestSession: latest
          ? {
              id: latest.id,
              provider: latest.provider,
              providerCallId: latest.providerCallId,
              status: latest.status,
              outcome: latest.outcome,
              durationSeconds: latest.durationSeconds,
              recordingReference: latest.recordingReference,
              failureReason: latest.failureReason,
              startedAt: latest.startedAt,
              connectedAt: latest.connectedAt,
              endedAt: latest.endedAt,
              isSimulated:
                (latest.metadata as any)?.isSimulated ?? (latest.provider === 'MOCK_TELEPHONY'),
            }
          : null,
      };
    });
  }

  /**
   * Retrieves full details for a single call job including all call sessions and transcript messages, strictly scoped to tenant.
   */
  async getJobDetails(jobId: string, clientId: string) {
    const job = await this.prisma.aiCallJob.findFirst({
      where: { id: jobId, clientId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            source: true,
            stage: true,
            doNotCall: true,
            preferredLanguage: true,
            createdAt: true,
          },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              orderBy: { turnOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!job) {
      return null;
    }

    const mappedSessions = job.sessions.map((s) => ({
      ...s,
      isSimulated: (s.metadata as any)?.isSimulated ?? (s.provider === 'MOCK_TELEPHONY'),
    }));

    return {
      ...job,
      leadName: `${job.lead?.firstName || ''} ${job.lead?.lastName || ''}`.trim() || 'Unknown Lead',
      phone: job.lead?.phone || '—',
      source: job.lead?.source || '—',
      sessions: mappedSessions,
      latestSession: mappedSessions[0] || null,
    };
  }
}

