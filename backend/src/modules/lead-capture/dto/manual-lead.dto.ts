import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
} from 'class-validator';
import { ChannelType, LeadTemperature } from '@prisma/client';

export class CreateManualLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail({}, { message: 'A valid email is required' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsEnum(ChannelType)
  @IsOptional()
  source?: ChannelType = ChannelType.OTHER;

  @IsString()
  @IsOptional()
  campaign?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  stageId?: string;

  @IsEnum(LeadTemperature)
  @IsOptional()
  temperature?: LeadTemperature = LeadTemperature.COLD;

  @IsNumber()
  @IsOptional()
  dealValue?: number;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsString()
  @IsOptional()
  assignedTeamId?: string;

  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;
}
