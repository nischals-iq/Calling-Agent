import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminPlansService } from './admin-plans.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';

@Controller('admin/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminPlansController {
  constructor(private readonly plansService: AdminPlansService) {}

  @Get()
  getPlans() {
    return this.plansService.getAllPlans();
  }
}
