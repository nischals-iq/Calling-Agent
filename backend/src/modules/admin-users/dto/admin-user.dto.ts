import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class CreateAdminUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @IsEmail({}, { message: 'Valid email is required' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsOptional()
  mobile?: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];
}

export class UpdateAdminUserDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  mobile?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAdminUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}
