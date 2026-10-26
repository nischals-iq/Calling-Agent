import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string; // 'SALES', 'MARKETING', 'SUPPORT'

  @IsString()
  @IsOptional()
  managerId?: string;

  @IsArray()
  @IsOptional()
  memberIds?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  managerId?: string | null;

  @IsArray()
  @IsOptional()
  memberIds?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignTeamMembersDto {
  @IsArray()
  @IsNotEmpty({ message: 'memberIds array is required' })
  memberIds: string[];
}
