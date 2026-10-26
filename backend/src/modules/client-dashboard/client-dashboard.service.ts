import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ClientDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        plan: true,
        businessCategory: true,
        status: true,
        timezone: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Client tenant not found');
    }

    const [
      totalUsers,
      activeUsers,
      totalTeams,
      totalLeads,
      leadStages,
      teams,
      topUsers,
      recentActivities,
    ] = await Promise.all([
      // Users count
      this.prisma.user.count({ where: { clientId } }),
      this.prisma.user.count({ where: { clientId, isActive: true } }),

      // Teams count
      this.prisma.team.count({ where: { clientId } }),

      // Leads count
      this.prisma.lead.count({ where: { clientId } }),

      // Lead Funnel (Pipeline stages with lead count)
      this.prisma.leadStage.findMany({
        where: { clientId },
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: { leads: true },
          },
        },
      }),

      // Teams with metrics
      this.prisma.team.findMany({
        where: { clientId },
        select: {
          id: true,
          name: true,
          type: true,
          isActive: true,
          _count: {
            select: {
              members: true,
              leads: true,
            },
          },
        },
      }),

      // Top Users by assigned leads
      this.prisma.user.findMany({
        where: { clientId, isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          team: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              assignedLeads: true,
              assignedTasks: true,
            },
          },
        },
        orderBy: {
          assignedLeads: {
            _count: 'desc',
          },
        },
        take: 5,
      }),

      // Recent Activity Feed
      this.prisma.auditLog.findMany({
        where: { clientId },
        select: {
          id: true,
          action: true,
          resource: true,
          details: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    ]);

    // Calculate funnel summary
    const funnel = leadStages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      color: stage.color || '#6366F1',
      probability: stage.probability ?? 50,
      isWon: stage.isWon,
      isLost: stage.isLost,
      count: stage._count.leads,
    }));

    const wonStage = leadStages.find((s) => s.isWon);
    const wonCount = wonStage ? wonStage._count.leads : 0;
    const conversionRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 100) : 0;

    return {
      client,
      kpis: {
        totalUsers,
        activeUsers,
        totalTeams,
        totalLeads,
        wonLeads: wonCount,
        conversionRate,
      },
      funnel,
      teams,
      teamPerformance: topUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        teamName: u.team?.name || 'Unassigned',
        assignedLeads: u._count.assignedLeads,
        assignedTasks: u._count.assignedTasks,
      })),
      recentActivities,
    };
  }
}
