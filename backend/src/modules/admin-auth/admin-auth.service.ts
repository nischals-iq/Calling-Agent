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
import { AdminLoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/admin-auth.dto.js';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async login(dto: AdminLoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      await this.auditLogsService.log({
        action: 'ADMIN_LOGIN_FAILED',
        resource: 'User',
        details: { reason: 'User not found', email: dto.email },
        ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      await this.auditLogsService.log({
        action: 'ADMIN_LOGIN_FAILED',
        resource: 'User',
        resourceId: user.id,
        details: { reason: 'Account is deactivated', email: dto.email },
        ipAddress,
      });
      throw new UnauthorizedException('Your account has been deactivated. Contact support.');
    }

    // Must be platform admin
    if (user.role !== UserRole.PLATFORM_ADMIN) {
      await this.auditLogsService.log({
        action: 'ADMIN_LOGIN_FORBIDDEN',
        resource: 'User',
        resourceId: user.id,
        details: { reason: 'Non-platform admin attempted admin portal login', role: user.role },
        ipAddress,
      });
      throw new UnauthorizedException('Access denied. Platform Admin privileges required.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditLogsService.log({
        action: 'ADMIN_LOGIN_FAILED',
        resource: 'User',
        resourceId: user.id,
        details: { reason: 'Invalid password' },
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
      permissions: (user.permissions as string[]) || [],
    };

    const token = this.jwtService.sign(payload);

    await this.auditLogsService.log({
      userId: user.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
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
        permissions: (user.permissions as string[]) || [],
      },
    };
  }

  async logout(userId: string, ipAddress?: string) {
    await this.auditLogsService.log({
      userId,
      action: 'ADMIN_LOGOUT',
      resource: 'User',
      resourceId: userId,
      details: { message: 'Logged out successfully' },
      ipAddress,
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (user && user.role === UserRole.PLATFORM_ADMIN) {
      await this.auditLogsService.log({
        userId: user.id,
        action: 'ADMIN_FORGOT_PASSWORD_REQUESTED',
        resource: 'User',
        resourceId: user.id,
        details: { email: user.email },
        ipAddress,
      });
    }

    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with this email, password reset instructions have been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new BadRequestException('Invalid reset request');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.auditLogsService.log({
      userId: user.id,
      action: 'ADMIN_PASSWORD_RESET',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress,
    });

    return { success: true, message: 'Password has been reset successfully. You can now login.' };
  }
}
