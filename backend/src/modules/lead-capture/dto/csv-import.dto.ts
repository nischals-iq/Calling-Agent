import {
  IsArray,
  IsObject,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';
import { ChannelType, LeadTemperature } from '@prisma/client';

export class PreviewCsvImportDto {
  @IsArray()
  rawRows: Record<string, any>[];

  @IsObject()
  columnMapping: Record<string, string>;
}

export class ConfirmCsvImportDto {
  @IsArray()
  rows: Record<string, any>[];

  @IsEnum(ChannelType)
  @IsOptional()
  defaultSource?: ChannelType = ChannelType.CSV_IMPORT;

  @IsString()
  @IsOptional()
  defaultCampaign?: string;

  @IsString()
  @IsOptional()
  defaultStageId?: string;

  @IsEnum(LeadTemperature)
  @IsOptional()
  defaultTemperature?: LeadTemperature = LeadTemperature.COLD;

  @IsString()
  @IsOptional()
  duplicateHandling?: 'FLAG' | 'SKIP' = 'FLAG';
}
