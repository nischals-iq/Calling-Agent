import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ChannelType, LeadTemperature } from '@prisma/client';

export class LeadQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(ChannelType)
  @IsOptional()
  source?: ChannelType;

  @IsString()
  @IsOptional()
  stageId?: string;

  @IsEnum(LeadTemperature)
  @IsOptional()
  temperature?: LeadTemperature;

  @IsString()
  @IsOptional()
  isDuplicate?: string; // 'true' | 'false' | 'all'

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}
