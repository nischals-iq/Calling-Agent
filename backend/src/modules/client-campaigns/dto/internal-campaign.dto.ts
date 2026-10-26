import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUrl,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInternalCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'Campaign name is required' })
  @MaxLength(150, { message: 'Campaign name cannot exceed 150 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Campaign objective is required' })
  @IsIn(['LEADS'], {
    message: 'Objective must be LEADS',
  })
  objective: string = 'LEADS';

  @IsOptional()
  @IsNumber({}, { message: 'Total budget must be a positive number' })
  @Min(1, { message: 'Total budget must be at least 1' })
  totalBudget?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  endDate?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'Landing page URL must be a valid URL with http or https protocol' },
  )
  landingPageUrl?: string;

  @IsOptional()
  locations?: string[] | any;

  @IsOptional()
  @IsInt({ message: 'Minimum age must be an integer' })
  @Min(13, { message: 'Minimum age cannot be less than 13' })
  @Max(65, { message: 'Minimum age cannot be greater than 65' })
  minAge?: number = 18;

  @IsOptional()
  @IsInt({ message: 'Maximum age must be an integer' })
  @Min(18, { message: 'Maximum age cannot be less than 18' })
  @Max(65, { message: 'Maximum age cannot be greater than 65' })
  maxAge?: number = 65;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'MALE', 'FEMALE'], { message: 'Gender must be ALL, MALE, or FEMALE' })
  gender?: string = 'ALL';

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Headline cannot exceed 255 characters' })
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Primary text cannot exceed 2000 characters' })
  primaryText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Call to action cannot exceed 100 characters' })
  callToAction?: string = 'LEARN_MORE';

  @IsOptional()
  @IsBoolean({ message: 'useMeta must be a boolean' })
  useMeta?: boolean = false;

  @IsOptional()
  @IsBoolean({ message: 'useGoogle must be a boolean' })
  useGoogle?: boolean = false;
}

export class UpdateInternalCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Campaign name cannot exceed 150 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['LEADS', 'WEBSITE_TRAFFIC'], {
    message: 'Objective must be either LEADS or WEBSITE_TRAFFIC',
  })
  objective?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Total budget must be a positive number' })
  @Min(1, { message: 'Total budget must be at least 1' })
  totalBudget?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  endDate?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'Landing page URL must be a valid URL with http or https protocol' },
  )
  landingPageUrl?: string;

  @IsOptional()
  locations?: string[] | any;

  @IsOptional()
  @IsInt({ message: 'Minimum age must be an integer' })
  @Min(13, { message: 'Minimum age cannot be less than 13' })
  @Max(65, { message: 'Minimum age cannot be greater than 65' })
  minAge?: number;

  @IsOptional()
  @IsInt({ message: 'Maximum age must be an integer' })
  @Min(18, { message: 'Maximum age cannot be less than 18' })
  @Max(65, { message: 'Maximum age cannot be greater than 65' })
  maxAge?: number;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'MALE', 'FEMALE'], { message: 'Gender must be ALL, MALE, or FEMALE' })
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Headline cannot exceed 255 characters' })
  headline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Primary text cannot exceed 2000 characters' })
  primaryText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Call to action cannot exceed 100 characters' })
  callToAction?: string;

  @IsOptional()
  @IsBoolean({ message: 'useMeta must be a boolean' })
  useMeta?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'useGoogle must be a boolean' })
  useGoogle?: boolean;
}

export class PublishInternalCampaignDto {
  @IsString()
  @IsNotEmpty({ message: 'Target platform is required' })
  @IsIn(['META', 'GOOGLE', 'BOTH'], {
    message: 'Platform must be META, GOOGLE, or BOTH',
  })
  platform: 'META' | 'GOOGLE' | 'BOTH';
}

export class CreateGoogleCampaignBudgetDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Budget name cannot exceed 150 characters' })
  name?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Budget amount must be a number' })
  @Min(1, { message: 'Budget amount must be at least 1' })
  amountInMajor?: number;

  @IsOptional()
  @IsBoolean()
  explicitlyShared?: boolean;
}

export class CreateGoogleSearchCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Campaign name cannot exceed 150 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  budgetResourceName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  endDate?: string;
}

export class CreateGoogleAdGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Ad group name cannot exceed 150 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  campaignResourceName?: string;

  @IsOptional()
  @IsNumber({}, { message: 'CPC bid must be a number' })
  @Min(1, { message: 'CPC bid must be at least 1' })
  cpcBidInMajor?: number;
}

export class KeywordItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Keyword text cannot be empty' })
  @MaxLength(80, { message: 'Keyword text cannot exceed 80 characters' })
  text: string;

  @IsOptional()
  @IsString()
  @IsIn(['BROAD', 'PHRASE', 'EXACT'], {
    message: 'Match type must be BROAD, PHRASE, or EXACT',
  })
  matchType?: 'BROAD' | 'PHRASE' | 'EXACT';
}

export class CreateGoogleKeywordsDto {
  @IsOptional()
  @IsString()
  adGroupResourceName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeywordItemDto)
  keywords?: KeywordItemDto[];
}

export class CreateGoogleResponsiveSearchAdDto {
  @IsOptional()
  @IsString()
  adGroupResourceName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  headlines?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  descriptions?: string[];

  @IsOptional()
  @IsString()
  finalUrl?: string;
}

