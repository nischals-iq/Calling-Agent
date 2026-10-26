import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import {
  CreateClientUserDto,
  UpdateClientUserDto,
  ResetClientUserPasswordDto,
  ClientUserQueryDto,
} from './dto/client-user.dto.js';
import { UserRole } from '@prisma/client';

@Injectable()
export class ClientUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getUsers(clientId: string, query: ClientUserQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { clientId };

    if (query.role) {
      where.role = query.role;
    }

    if (query.teamId) {
      where.teamId = query.teamId;
    }

    if (query.status === 'ACTIVE') {
      where.isActive = true;
    } else if (query.status === 'INACTIVE') {
      where.isActive = false;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { mobile: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          mobile: true,
          role: true,
          isActive: true,
          avatarUrl: true,
          lastLoginAt: true,
          createdAt: true,
          permissions: true,
          teamId: true,
          team: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              assignedLeads: true,
              assignedTasks: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string, clientId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        lastLoginAt: true,
        createdAt: true,
        permissions: true,
        preferences: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            assignedLeads: true,
            assignedTasks: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Client user not found or does not belong to this organization');
    }

    return user;
  }

  async createUser(
    clientId: string,
    creatorId: string,
    dto: CreateClientUserDto,
    ipAddress?: string,
  ) {
    // 1. Verify client & plan quotas
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { _count: { select: { users: true } } },
    });

    if (!client) {
      throw new NotFoundException('Client organization not found');
    }

    // Check plan limits
    const planLimits: Record<string, number> = {
      FREE: 2,
      STARTER: 5,
      PRO: 25,
      ENTERPRISE: 10000,
    };
    const maxUsers = planLimits[client.plan] || 5;
    if (client._count.users >= maxUsers) {
      throw new BadRequestException(
        `User limit reached for current ${client.plan} subscription (${client._count.users}/${maxUsers} seats used). Upgrade plan to invite more users.`,
      );
    }

    // 2. Prevent duplicate email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException('A user account with this email address already exists');
    }

    // 3. Verify team belongs to tenant if specified
    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: dto.teamId, clientId },
      });
      if (!team) {
        throw new BadRequestException('Selected team does not belong to this organization');
      }
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // 5. Create user
    const newUser = await this.prisma.user.create({
      data: {
        clientId,
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        mobile: dto.mobile?.trim(),
        role: dto.role,
        passwordHash,
        teamId: dto.teamId || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        permissions: dto.permissions || [],
      },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        role: true,
        isActive: true,
        teamId: true,
        createdAt: true,
        permissions: true,
      },
    });

    await this.auditLogsService.log({
      clientId,
      userId: creatorId,
      action: 'CLIENT_USER_CREATED',
      resource: 'User',
      resourceId: newUser.id,
      details: { email: newUser.email, name: newUser.name, role: newUser.role },
      ipAddress,
    });

    return newUser;
  }

  async updateUser(
    userId: string,
    clientId: string,
    modifierId: string,
    dto: UpdateClientUserDto,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException('Client user not found');
    }

    // Verify team belongs to tenant if updated
    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: dto.teamId, clientId },
      });
      if (!team) {
        throw new BadRequestException('Selected team does not belong to this organization');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.mobile !== undefined && { mobile: dto.mobile?.trim() }),
        ...(dto.role && { role: dto.role }),
        ...(dto.teamId !== undefined && { teamId: dto.teamId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.permissions !== undefined && { permissions: dto.permissions }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        role: true,
        isActive: true,
        teamId: true,
        permissions: true,
      },
    });

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: 'CLIENT_USER_UPDATED',
      resource: 'User',
      resourceId: userId,
      details: { updatedFields: dto },
      ipAddress,
    });

    return updated;
  }

  async toggleUserStatus(
    userId: string,
    clientId: string,
    modifierId: string,
    isActive: boolean,
    ipAddress?: string,
  ) {
    if (userId === modifierId) {
      throw new BadRequestException('You cannot activate or deactivate your own account');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException('Client user not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: isActive ? 'CLIENT_USER_ACTIVATED' : 'CLIENT_USER_DEACTIVATED',
      resource: 'User',
      resourceId: userId,
      details: { email: user.email, isActive },
      ipAddress,
    });

    return updated;
  }

  async resetPassword(
    userId: string,
    clientId: string,
    modifierId: string,
    dto: ResetClientUserPasswordDto,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException('Client user not found');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: 'CLIENT_USER_PASSWORD_RESET',
      resource: 'User',
      resourceId: userId,
      details: { email: user.email },
      ipAddress,
    });

    return { success: true, message: 'Password reset successfully' };
  }

  async deleteUser(
    userId: string,
    clientId: string,
    modifierId: string,
    ipAddress?: string,
  ) {
    if (userId === modifierId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException('Client user not found');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    await this.auditLogsService.log({
      clientId,
      userId: modifierId,
      action: 'CLIENT_USER_DELETED',
      resource: 'User',
      resourceId: userId,
      details: { email: user.email, name: user.name },
      ipAddress,
    });

    return { success: true, message: 'User deleted successfully' };
  }
}
