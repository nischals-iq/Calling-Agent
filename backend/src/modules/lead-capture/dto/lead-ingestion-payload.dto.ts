import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsDateString,
} from 'class-validator';
import { ChannelType, LeadTemperature } from '@prisma/client';

export class IngestLeadPayload {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail({}, { message: 'A valid email address is required' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  jobTitle?: string;

  @IsEnum(ChannelType)
  @IsOptional()
  source?: ChannelType = ChannelType.WEBSITE;

  @IsString()
  @IsOptional()
  medium?: string;

  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;

  @IsString()
  @IsOptional()
  adSetId?: string;

  @IsString()
  @IsOptional()
  adId?: string;

  @IsString()
  @IsOptional()
  formId?: string;

  @IsString()
  @IsOptional()
  landingPageUrl?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  utmContent?: string;

  @IsString()
  @IsOptional()
  utmTerm?: string;

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

  @IsDateString()
  @IsOptional()
  submittedAt?: string;

  @IsString()
  @IsOptional()
  duplicateHandling?: 'FLAG' | 'SKIP' | 'REJECT' = 'FLAG';
}
