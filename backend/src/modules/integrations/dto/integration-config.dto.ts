import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Matches,
  ValidateIf,
  IsEnum,
  IsObject,
} from 'class-validator';
import { ChannelType } from '@prisma/client';

export class UpdateMetaConfigDto {
  @IsString({ message: 'Enter a valid numeric Meta App ID.' })
  @IsNotEmpty({ message: 'Enter a valid numeric Meta App ID.' })
  @Matches(/^[0-9]+$/, { message: 'Enter a valid numeric Meta App ID.' })
  appId!: string;

  @IsString()
  @IsNotEmpty()
  appSecret!: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsString()
  @IsOptional()
  webhookVerifyToken?: string;

  @IsString()
  @IsOptional()
  apiVersion?: string;

  @IsString()
  @IsOptional()
  businessId?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.pageId !== undefined && o.pageId !== null && o.pageId !== '')
  @Matches(/^[0-9]+$/, { message: 'Connected Page ID must be numeric.' })
  pageId?: string;

  @IsString()
  @IsOptional()
  pageName?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.leadFormId !== undefined && o.leadFormId !== null && o.leadFormId !== '')
  @Matches(/^[0-9]+$/, { message: 'Lead Form ID must be numeric.' })
  leadFormId?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.formId !== undefined && o.formId !== null && o.formId !== '')
  @Matches(/^[0-9]+$/, { message: 'Lead Form ID must be numeric.' })
  formId?: string;

  @IsString()
  @IsOptional()
  leadFormName?: string;

  @IsString()
  @IsOptional()
  formName?: string;

  @IsString()
  @IsOptional()
  adAccountId?: string;

  @IsString()
  @IsOptional()
  adAccountName?: string;
}

export class UpdateGoogleConfigDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  clientSecret!: string;

  @IsString()
  @IsNotEmpty()
  developerToken!: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsOptional()
  managerAccountId?: string;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsString()
  @IsOptional()
  googleKey?: string;

  @IsString()
  @IsOptional()
  webhookKey?: string;

  @IsString()
  @IsOptional()
  formId?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}

export class UpdateLinkedinConfigDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  clientSecret!: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  organizationName?: string;

  @IsString()
  @IsOptional()
  leadFormId?: string;

  @IsString()
  @IsOptional()
  leadFormName?: string;
}

export class SelectIntegrationSourceDto {
  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  pageId?: string;

  @IsString()
  @IsOptional()
  pageName?: string;

  @IsString()
  @IsOptional()
  formId?: string;

  @IsString()
  @IsOptional()
  formName?: string;

  @IsString()
  @IsOptional()
  googleKey?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}

export class TestIntegrationDto {
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}
