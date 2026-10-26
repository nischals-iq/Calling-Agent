import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import {
  CreateTeamDto,
  UpdateTeamDto,
  AssignTeamMembersDto,
} from './dto/client-team.dto.js';

@Injectable()
export class ClientTeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getTeams(clientId: string) {
    return this.prisma.team.findMany({
      where: { clientId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            members: true,
            leads: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getTeamById(teamId: string, clientId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, clientId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            mobile: true,
            avatarUrl: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            members: true,
            leads: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found in this organization');
    }

    return team;
  }

  async createTeam(
    clientId: string,
    creatorId: string,
    dto: CreateTeamDto,
    ipAddress?: string,
  ) {
    // Verify manager belongs to tenant
    if (dto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: dto.managerId, clientId },
      });
      if (!manager) {
        throw new BadRequestException('Team manager must belong to this organization');
      }
    }

    // Verify all memberIds belong to tenant
    if (dto.memberIds && dto.memberIds.length > 0) {
      const memberCount = await this.prisma.user.count({
        where: { id: { in: dto.memberIds }, clientId },
      });
      if (memberCount !== dto.memberIds.length) {
        throw new BadRequestException('One or more selected members do not belong to this organization');
      }
    }

    const team = await this.prisma.team.create({
      data: {
        clientId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        type: dto.type || 'SALES',
        managerId: dto.managerId || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    // Assign members to team
    if (dto.memberIds && dto.memberIds.length > 0) {
      await this.prisma.user.updateMany({
        where: { id: { in: dto.memberIds }, clientId },
        data: { teamId: team.id },
      });
    }

    await this.auditLogsService.log({
      clientId,
      userId: creatorId,
      action: 'TEAM_CREATED',
      resource: 'Team',
      resourceId: team.id,
      details: { name: team.name, type: team.type, memberCount: dto.memberIds?.length || 0 },
      ipAddress,
    });

    return this.getTeamById(team.id, clientId);
  }

  async updateTeam(
    teamId: string,
    clientId: string,
    modifierId: string,
    dto: UpdateTeamDto,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.team.findFirst({
      where: { id: teamId, clientId },
    });

    if (!existing) {
      throw new NotFoundException('Team not found');
    }

    if (dto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: dto.managerId, clientId },
      });
      if (!manager) {
        throw new BadRequestException('Team manager must belong to this organization');
      }
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.type && { type: dto.type }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Update member assignments if array provided
    if (dto.memberIds !== undefined) {
      // 1. Remove members who were in this team but not in memberIds
      await this.prisma.user.updateMany({
        where: { teamId, clientId, id: { notIn: dto.memberIds } },
        data: { teamId: null },
      });

      // 2. Add members in memberIds
      if (dto.memberIds.length > 0) {
        await this.prisma.user.updateMany({
          where: { id: { in: dto.memberIds }, clientId },
          data: { teamId },
        });
      }
    }

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: 'TEAM_UPDATED',
      resource: 'Team',
      resourceId: teamId,
      details: dto,
      ipAddress,
    });

    return this.getTeamById(teamId, clientId);
  }

  async toggleTeamStatus(
    teamId: string,
    clientId: string,
    modifierId: string,
    isActive: boolean,
    ipAddress?: string,
  ) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, clientId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: { isActive },
    });

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: isActive ? 'TEAM_ACTIVATED' : 'TEAM_DEACTIVATED',
      resource: 'Team',
      resourceId: teamId,
      details: { name: team.name, isActive },
      ipAddress,
    });

    return updated;
  }

  async assignMembers(
    teamId: string,
    clientId: string,
    modifierId: string,
    dto: AssignTeamMembersDto,
    ipAddress?: string,
  ) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, clientId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Verify members
    if (dto.memberIds.length > 0) {
      const count = await this.prisma.user.count({
        where: { id: { in: dto.memberIds }, clientId },
      });
      if (count !== dto.memberIds.length) {
        throw new BadRequestException('One or more selected users do not belong to this organization');
      }

      await this.prisma.user.updateMany({
        where: { id: { in: dto.memberIds }, clientId },
        data: { teamId },
      });
    }

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: 'TEAM_MEMBERS_ASSIGNED',
      resource: 'Team',
      resourceId: teamId,
      details: { memberCount: dto.memberIds.length },
      ipAddress,
    });

    return this.getTeamById(teamId, clientId);
  }

  async deleteTeam(
    teamId: string,
    clientId: string,
    modifierId: string,
    ipAddress?: string,
  ) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, clientId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Unassign users
    await this.prisma.user.updateMany({
      where: { teamId, clientId },
      data: { teamId: null },
    });

    await this.prisma.team.delete({
      where: { id: teamId },
    });

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: 'TEAM_DELETED',
      resource: 'Team',
      resourceId: teamId,
      details: { name: team.name },
      ipAddress,
    });

    return { success: true, message: 'Team deleted successfully' };
  }
}
