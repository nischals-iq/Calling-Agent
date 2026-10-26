import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ChannelType } from '@prisma/client';

export class PublicLeadCaptureDto {
  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  firstName: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail({}, { message: 'A valid email is required if provided' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  message?: string;

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
  adId?: string;

  @IsString()
  @IsOptional()
  adSetId?: string;

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

  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;
}
