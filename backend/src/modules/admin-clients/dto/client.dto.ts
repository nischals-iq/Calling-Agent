import {
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsEnum,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientStatus, SubscriptionPlan } from '@prisma/client';

export class CreateClientAdminUserDto {
  @IsNotEmpty({ message: 'Admin name is required' })
  name: string;

  @IsEmail({}, { message: 'Invalid admin email' })
  @IsNotEmpty({ message: 'Admin email is required' })
  email: string;

  @IsNotEmpty({ message: 'Admin password is required' })
  password: string;

  @IsOptional()
  mobile?: string;
}

export class CreateClientDto {
  @IsNotEmpty({ message: 'Company Name is required' })
  name: string;

  @IsOptional()
  businessCategory?: string;

  @IsNotEmpty({ message: 'Primary Contact Name is required' })
  primaryContactName: string;

  @IsEmail({}, { message: 'Valid Primary Contact Email is required' })
  @IsNotEmpty({ message: 'Primary Contact Email is required' })
  primaryContactEmail: string;

  @IsOptional()
  primaryContactPhone?: string;

  @IsOptional()
  companyAddress?: string;

  @IsOptional()
  country?: string;

  @IsOptional()
  timezone?: string;

  @IsOptional()
  @IsEnum(ClientStatus)
  status?: ClientStatus;

  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @IsOptional()
  settings?: {
    leadSources?: string[];
    leadStages?: Array<{ name: string; color?: string; order?: number }>;
    notificationRules?: {
      emailOnNewLead?: boolean;
      whatsappOnNewLead?: boolean;
      dailySummaryEmail?: boolean;
    };
  };

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientAdminUserDto)
  initialAdmin?: CreateClientAdminUserDto;
}

export class UpdateClientDto {
  @IsOptional()
  name?: string;

  @IsOptional()
  businessCategory?: string;

  @IsOptional()
  primaryContactName?: string;

  @IsOptional()
  primaryContactEmail?: string;

  @IsOptional()
  primaryContactPhone?: string;

  @IsOptional()
  companyAddress?: string;

  @IsOptional()
  country?: string;

  @IsOptional()
  timezone?: string;

  @IsOptional()
  settings?: any;
}

export class UpdateClientStatusDto {
  @IsEnum(ClientStatus, { message: 'Status must be ACTIVE, INACTIVE, or SUSPENDED' })
  status: ClientStatus;
}

export class UpdateClientPlanDto {
  @IsEnum(SubscriptionPlan, { message: 'Invalid subscription plan' })
  plan: SubscriptionPlan;
}

export class UpdateClientConfigDto {
  @IsOptional()
  businessCategory?: string;

  @IsOptional()
  timezone?: string;

  @IsOptional()
  companyProfile?: {
    website?: string;
    description?: string;
    industry?: string;
  };

  @IsOptional()
  leadSources?: string[];

  @IsOptional()
  leadStages?: Array<{ id?: string; name: string; color?: string; order?: number; probability?: number }>;

  @IsOptional()
  notificationRules?: {
    emailOnNewLead?: boolean;
    whatsappOnNewLead?: boolean;
    dailySummaryEmail?: boolean;
  };
}
