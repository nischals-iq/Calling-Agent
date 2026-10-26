import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateAdminUserDto, UpdateAdminUserDto, UpdateAdminUserStatusDto } from './dto/admin-user.dto.js';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { role: UserRole.PLATFORM_ADMIN },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || user.role !== UserRole.PLATFORM_ADMIN) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    return user;
  }

  async create(dto: CreateAdminUserDto, currentAdminId: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const defaultPermissions = dto.permissions && dto.permissions.length > 0
      ? dto.permissions
      : [
          'clients:read',
          'clients:write',
          'plans:read',
          'plans:write',
          'admin_users:read',
          'admin_users:write',
          'audit_logs:read',
          'dashboard:read',
        ];

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        mobile: dto.mobile?.trim() || null,
        role: UserRole.PLATFORM_ADMIN,
        isActive: true,
        permissions: defaultPermissions,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
      },
    });

    await this.auditLogsService.log({
      userId: currentAdminId,
      action: 'ADMIN_USER_CREATED',
      resource: 'User',
      resourceId: user.id,
      details: { email: user.email, name: user.name, permissions: user.permissions },
      ipAddress,
    });

    return user;
  }

  async update(id: string, dto: UpdateAdminUserDto, currentAdminId: string, ipAddress?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== UserRole.PLATFORM_ADMIN) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    let passwordHash: string | undefined = undefined;
    if (dto.password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(dto.password, salt);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        mobile: dto.mobile !== undefined ? dto.mobile : undefined,
        permissions: dto.permissions !== undefined ? dto.permissions : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        permissions: true,
        updatedAt: true,
      },
    });

    await this.auditLogsService.log({
      userId: currentAdminId,
      action: 'ADMIN_USER_UPDATED',
      resource: 'User',
      resourceId: id,
      details: { updatedFields: Object.keys(dto) },
      ipAddress,
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateAdminUserStatusDto,
    currentAdminId: string,
    ipAddress?: string,
  ) {
    if (id === currentAdminId && !dto.isActive) {
      throw new BadRequestException('You cannot deactivate your own admin account');
    }

    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== UserRole.PLATFORM_ADMIN) {
      throw new NotFoundException(`Admin user with ID ${id} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await this.auditLogsService.log({
      userId: currentAdminId,
      action: dto.isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
      resource: 'User',
      resourceId: id,
      details: { email: existing.email, isActive: dto.isActive },
      ipAddress,
    });

    return updated;
  }
}
