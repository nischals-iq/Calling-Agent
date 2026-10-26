import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { AdminPlansService } from '../admin-plans/admin-plans.service.js';
import {
  CreateClientDto,
  UpdateClientDto,
  UpdateClientStatusDto,
  UpdateClientPlanDto,
  UpdateClientConfigDto,
} from './dto/client.dto.js';
import { ClientStatus, SubscriptionPlan, UserRole } from '@prisma/client';

@Injectable()
export class AdminClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly plansService: AdminPlansService,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ClientStatus;
    plan?: SubscriptionPlan;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.plan) {
      where.plan = query.plan;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { primaryContactName: { contains: query.search, mode: 'insensitive' } },
        { primaryContactEmail: { contains: query.search, mode: 'insensitive' } },
        { businessCategory: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, clients] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              leads: true,
              campaigns: true,
              integrations: true,
            },
          },
        },
      }),
    ]);

    return {
      data: clients.map((c) => ({
        ...c,
        metrics: {
          usersCount: c._count.users,
          leadsCount: c._count.leads,
          campaignsCount: c._count.campaigns,
          integrationsCount: c._count.integrations,
        },
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        integrations: {
          select: {
            id: true,
            channel: true,
            name: true,
            status: true,
            lastSyncedAt: true,
            errorMessage: true,
            createdAt: true,
          },
        },
        leadStages: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            users: true,
            leads: true,
            campaigns: true,
            integrations: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    const planDetails = this.plansService.getPlan(client.plan);
    const recentActivity = await this.prisma.auditLog.findMany({
      where: { clientId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      client,
      usage: {
        plan: planDetails,
        metrics: {
          users: { current: client._count.users, max: planDetails.maxUsers },
          leads: { current: client._count.leads, max: planDetails.maxLeads },
          campaigns: { current: client._count.campaigns, max: planDetails.maxCampaigns },
        },
        enabledModules: planDetails.enabledModules,
      },
      recentActivity,
    };
  }

  async create(dto: CreateClientDto, adminUserId: string, ipAddress?: string) {
    // Check if primary contact email already exists for a client
    const existingClient = await this.prisma.client.findFirst({
      where: { primaryContactEmail: dto.primaryContactEmail.toLowerCase().trim() },
    });
    if (existingClient) {
      throw new ConflictException(
        `A client with primary email ${dto.primaryContactEmail} already exists`,
      );
    }

    // If initial admin is provided, check if user email is taken
    if (dto.initialAdmin?.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.initialAdmin.email.toLowerCase().trim() },
      });
      if (existingUser) {
        throw new ConflictException(
          `User account with email ${dto.initialAdmin.email} already exists`,
        );
      }
    }

    const defaultStages = [
      { name: 'New', order: 1, color: '#3B82F6', probability: 10, isWon: false, isLost: false },
      { name: 'Contacted', order: 2, color: '#8B5CF6', probability: 25, isWon: false, isLost: false },
      { name: 'Qualified', order: 3, color: '#EC4899', probability: 40, isWon: false, isLost: false },
      { name: 'Demo/Meeting', order: 4, color: '#EAB308', probability: 60, isWon: false, isLost: false },
      { name: 'Proposal', order: 5, color: '#F97316', probability: 75, isWon: false, isLost: false },
      { name: 'Negotiation', order: 6, color: '#06B6D4', probability: 90, isWon: false, isLost: false },
      { name: 'Won', order: 7, color: '#10B981', probability: 100, isWon: true, isLost: false },
      { name: 'Lost', order: 8, color: '#EF4444', probability: 0, isWon: false, isLost: true },
    ];

    const defaultLeadSources = dto.settings?.leadSources ?? [
      'META',
      'GOOGLE',
      'LINKEDIN',
      'WEBSITE',
      'WHATSAPP',
      'REFERRAL',
    ];

    const mergedSettings = {
      leadSources: defaultLeadSources,
      notificationRules: dto.settings?.notificationRules ?? {
        emailOnNewLead: true,
        whatsappOnNewLead: false,
        dailySummaryEmail: true,
      },
      ...dto.settings,
    };

    // Create client along with default lead stages in transaction
    const newClient = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: dto.name.trim(),
          businessCategory: dto.businessCategory?.trim() || null,
          primaryContactName: dto.primaryContactName.trim(),
          primaryContactEmail: dto.primaryContactEmail.toLowerCase().trim(),
          primaryContactPhone: dto.primaryContactPhone?.trim() || null,
          companyAddress: dto.companyAddress?.trim() || null,
          country: dto.country?.trim() || 'India',
          timezone: dto.timezone?.trim() || 'Asia/Kolkata',
          status: dto.status ?? ClientStatus.ACTIVE,
          plan: dto.plan ?? SubscriptionPlan.STARTER,
          settings: mergedSettings,
          leadStages: {
            create: defaultStages,
          },
        },
      });

      // If initial admin details provided, create client admin user
      if (dto.initialAdmin?.email && dto.initialAdmin?.password) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(dto.initialAdmin.password, salt);

        await tx.user.create({
          data: {
            clientId: client.id,
            name: dto.initialAdmin.name.trim(),
            email: dto.initialAdmin.email.toLowerCase().trim(),
            passwordHash,
            mobile: dto.initialAdmin.mobile?.trim() || dto.primaryContactPhone?.trim() || null,
            role: UserRole.CLIENT_ADMIN,
            isActive: true,
            permissions: [
              'dashboard:read',
              'leads:read',
              'leads:write',
              'campaigns:read',
              'users:manage',
              'integrations:manage',
              'settings:manage',
            ],
          },
        });
      }

      return client;
    });

    await this.auditLogsService.log({
      userId: adminUserId,
      clientId: newClient.id,
      action: 'CLIENT_CREATED',
      resource: 'Client',
      resourceId: newClient.id,
      details: {
        name: newClient.name,
        plan: newClient.plan,
        primaryContactEmail: newClient.primaryContactEmail,
      },
      ipAddress,
    });

    return this.findOne(newClient.id);
  }

  async update(id: string, dto: UpdateClientDto, adminUserId: string, ipAddress?: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    if (dto.primaryContactEmail && dto.primaryContactEmail !== existing.primaryContactEmail) {
      const emailTaken = await this.prisma.client.findFirst({
        where: {
          primaryContactEmail: dto.primaryContactEmail.toLowerCase().trim(),
          id: { not: id },
        },
      });
      if (emailTaken) {
        throw new ConflictException(`Email ${dto.primaryContactEmail} is already in use`);
      }
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        businessCategory: dto.businessCategory !== undefined ? dto.businessCategory : undefined,
        primaryContactName: dto.primaryContactName ? dto.primaryContactName.trim() : undefined,
        primaryContactEmail: dto.primaryContactEmail
          ? dto.primaryContactEmail.toLowerCase().trim()
          : undefined,
        primaryContactPhone: dto.primaryContactPhone !== undefined ? dto.primaryContactPhone : undefined,
        companyAddress: dto.companyAddress !== undefined ? dto.companyAddress : undefined,
        country: dto.country !== undefined ? dto.country : undefined,
        timezone: dto.timezone !== undefined ? dto.timezone : undefined,
        settings: dto.settings !== undefined ? dto.settings : undefined,
      },
    });

    await this.auditLogsService.log({
      userId: adminUserId,
      clientId: id,
      action: 'CLIENT_UPDATED',
      resource: 'Client',
      resourceId: id,
      details: { updatedFields: Object.keys(dto) },
      ipAddress,
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateClientStatusDto,
    adminUserId: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.auditLogsService.log({
      userId: adminUserId,
      clientId: id,
      action: dto.status === ClientStatus.ACTIVE ? 'CLIENT_ACTIVATED' : 'CLIENT_DEACTIVATED',
      resource: 'Client',
      resourceId: id,
      details: { previousStatus: existing.status, newStatus: dto.status },
      ipAddress,
    });

    return updated;
  }

  async updatePlan(id: string, dto: UpdateClientPlanDto, adminUserId: string, ipAddress?: string) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: { plan: dto.plan },
    });

    await this.auditLogsService.log({
      userId: adminUserId,
      clientId: id,
      action: 'CLIENT_PLAN_CHANGED',
      resource: 'Client',
      resourceId: id,
      details: { previousPlan: existing.plan, newPlan: dto.plan },
      ipAddress,
    });

    return updated;
  }

  async updateConfig(
    id: string,
    dto: UpdateClientConfigDto,
    adminUserId: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const currentSettings = (existing.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      companyProfile: dto.companyProfile ?? currentSettings.companyProfile,
      leadSources: dto.leadSources ?? currentSettings.leadSources,
      notificationRules: dto.notificationRules ?? currentSettings.notificationRules,
    };

    // Update client settings
    await this.prisma.client.update({
      where: { id },
      data: {
        businessCategory: dto.businessCategory ?? existing.businessCategory,
        timezone: dto.timezone ?? existing.timezone,
        settings: updatedSettings,
      },
    });

    // If lead stages were provided, update them
    if (dto.leadStages && dto.leadStages.length > 0) {
      // Upsert or replace lead stages
      for (const [index, stage] of dto.leadStages.entries()) {
        if (stage.id) {
          await this.prisma.leadStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name,
              color: stage.color,
              order: stage.order ?? index + 1,
              probability: stage.probability,
            },
          });
        } else {
          await this.prisma.leadStage.create({
            data: {
              clientId: id,
              name: stage.name,
              color: stage.color || '#3B82F6',
              order: stage.order ?? index + 1,
              probability: stage.probability ?? 10,
            },
          });
        }
      }
    }

    await this.auditLogsService.log({
      userId: adminUserId,
      clientId: id,
      action: 'CLIENT_CONFIGURATION_UPDATED',
      resource: 'Client',
      resourceId: id,
      details: { updatedKeys: Object.keys(dto) },
      ipAddress,
    });

    return this.findOne(id);
  }
}
