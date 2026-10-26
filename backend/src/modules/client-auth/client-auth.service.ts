import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import {
  ClientLoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
  UpdatePreferencesDto,
} from './dto/client-auth.dto.js';
import { ClientStatus, UserRole } from '@prisma/client';

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async login(dto: ClientLoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            status: true,
            plan: true,
            businessCategory: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      await this.auditLogsService.log({
        action: 'CLIENT_LOGIN_FAILED',
        resource: 'User',
        details: { reason: 'User not found', email: dto.email },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.auditLogsService.log({
        clientId: user.clientId || undefined,
        userId: user.id,
        action: 'CLIENT_LOGIN_FAILED',
        resource: 'User',
        resourceId: user.id,
        details: { reason: 'User account is deactivated', email: dto.email },
        ipAddress,
      });
      throw new UnauthorizedException('Your account has been deactivated. Please contact your administrator.');
    }

    // Must be a client user (or platform admin accessing client context)
    if (!user.clientId && user.role !== UserRole.PLATFORM_ADMIN) {
      throw new UnauthorizedException('This account does not belong to a client organization.');
    }

    // If client is present, verify client status
    if (user.client && user.client.status !== ClientStatus.ACTIVE) {
      await this.auditLogsService.log({
        clientId: user.clientId || undefined,
        userId: user.id,
        action: 'CLIENT_LOGIN_FAILED',
        resource: 'Client',
        resourceId: user.client.id,
        details: { reason: 'Client tenant is inactive or suspended', status: user.client.status },
        ipAddress,
      });
      throw new UnauthorizedException(
        `Your organization account is currently ${user.client.status.toLowerCase()}. Please contact support.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditLogsService.log({
        clientId: user.clientId || undefined,
        userId: user.id,
        action: 'CLIENT_LOGIN_FAILED',
        resource: 'User',
        resourceId: user.id,
        details: { reason: 'Incorrect password', email: dto.email },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      permissions: (user.permissions as string[]) || [],
    };

    const token = this.jwtService.sign(payload);

    await this.auditLogsService.log({
      clientId: user.clientId || undefined,
      userId: user.id,
      action: 'CLIENT_LOGIN_SUCCESS',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email, role: user.role, client: user.client?.name },
      ipAddress,
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mobile: user.mobile,
        avatarUrl: user.avatarUrl,
        teamId: user.teamId,
        team: user.team,
        permissions: (user.permissions as string[]) || [],
        preferences: user.preferences,
      },
      client: user.client,
    };
  }

  async logout(userId: string, clientId?: string, ipAddress?: string) {
    await this.auditLogsService.log({
      clientId,
      userId,
      action: 'CLIENT_LOGOUT',
      resource: 'User',
      resourceId: userId,
      details: { message: 'Logged out successfully' },
      ipAddress,
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(userId: string, clientId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mobile: true,
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
        client: {
          select: {
            id: true,
            name: true,
            businessCategory: true,
            plan: true,
            status: true,
            timezone: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found in current organization');
    }

    return user;
  }

  async updateProfile(userId: string, clientId: string, dto: UpdateProfileDto, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        mobile: dto.mobile,
        avatarUrl: dto.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mobile: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    await this.auditLogsService.log({
      clientId,
      userId,
      action: 'PROFILE_UPDATED',
      resource: 'User',
      resourceId: userId,
      details: { updatedFields: { name: dto.name, mobile: dto.mobile } },
      ipAddress,
    });

    return updated;
  }

  async changePassword(
    userId: string,
    clientId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match our records');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await this.auditLogsService.log({
      clientId,
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      resourceId: userId,
      details: { message: 'Password changed successfully' },
      ipAddress,
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async updatePreferences(
    userId: string,
    clientId: string,
    dto: UpdatePreferencesDto,
    ipAddress?: string,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: dto.preferences as any,
      },
      select: {
        id: true,
        preferences: true,
      },
    });

    await this.auditLogsService.log({
      clientId,
      userId,
      action: 'PREFERENCES_UPDATED',
      resource: 'User',
      resourceId: userId,
      details: dto.preferences,
      ipAddress,
    });

    return updated;
  }
}
