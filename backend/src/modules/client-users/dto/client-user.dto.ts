import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateClientUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'A valid email is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsEnum(UserRole, { message: 'Invalid client user role' })
  role: UserRole;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];
}

export class UpdateClientUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsEnum(UserRole, { message: 'Invalid client user role' })
  @IsOptional()
  role?: UserRole;

  @IsString()
  @IsOptional()
  teamId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsOptional()
  permissions?: string[];
}

export class ResetClientUserPasswordDto {
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;
}

export class ClientUserQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  status?: string; // 'ACTIVE', 'INACTIVE', 'ALL'

  @IsOptional()
  page?: number | string;

  @IsOptional()
  limit?: number | string;
}
