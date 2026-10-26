import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientAuthService } from './client-auth.service.js';
import {
  ClientLoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
  UpdatePreferencesDto,
} from './dto/client-auth.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator.js';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface.js';

@Controller('client/auth')
export class ClientAuthController {
  constructor(private readonly authService: ClientAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: ClientLoginDto, @Ip() ipAddress: string) {
    return this.authService.login(dto, ipAddress);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Ip() ipAddress: string,
  ) {
    return this.authService.logout(user.id, tenantId, ipAddress);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
  ) {
    return this.authService.getProfile(user.id, tenantId);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateProfileDto,
    @Ip() ipAddress: string,
  ) {
    return this.authService.updateProfile(user.id, tenantId, dto, ipAddress);
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard, TenantGuard)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Body() dto: ChangePasswordDto,
    @Ip() ipAddress: string,
  ) {
    return this.authService.changePassword(user.id, tenantId, dto, ipAddress);
  }

  @Put('preferences')
  @UseGuards(JwtAuthGuard, TenantGuard)
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdatePreferencesDto,
    @Ip() ipAddress: string,
  ) {
    return this.authService.updatePreferences(user.id, tenantId, dto, ipAddress);
  }
}
