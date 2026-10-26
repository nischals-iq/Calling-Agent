import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  description: string;
  priceMonthly: number;
  maxUsers: number;
  maxLeads: number;
  maxCampaigns: number;
  enabledModules: string[];
  isActive: boolean;
}

@Injectable()
export class AdminPlansService {
  private readonly plans: Record<SubscriptionPlan, PlanDefinition> = {
    [SubscriptionPlan.FREE]: {
      id: SubscriptionPlan.FREE,
      name: 'Free Trial',
      description: 'Ideal for small evaluations and initial sandbox testing',
      priceMonthly: 0,
      maxUsers: 2,
      maxLeads: 100,
      maxCampaigns: 1,
      enabledModules: ['lead_management', 'basic_pipeline'],
      isActive: true,
    },
    [SubscriptionPlan.STARTER]: {
      id: SubscriptionPlan.STARTER,
      name: 'Starter Plan',
      description: 'Perfect for small teams launching their first digital campaigns',
      priceMonthly: 49,
      maxUsers: 5,
      maxLeads: 2500,
      maxCampaigns: 5,
      enabledModules: ['lead_management', 'pipeline', 'basic_integrations', 'tasks'],
      isActive: true,
    },
    [SubscriptionPlan.PRO]: {
      id: SubscriptionPlan.PRO,
      name: 'Professional Plan',
      description: 'Growing sales & marketing teams with multi-channel ad attribution',
      priceMonthly: 149,
      maxUsers: 25,
      maxLeads: 20000,
      maxCampaigns: 25,
      enabledModules: [
        'lead_management',
        'pipeline',
        'all_integrations',
        'campaign_attribution',
        'communication_timeline',
        'analytics_dashboard',
      ],
      isActive: true,
    },
    [SubscriptionPlan.ENTERPRISE]: {
      id: SubscriptionPlan.ENTERPRISE,
      name: 'Enterprise Plan',
      description: 'High volume organizations requiring custom limits & unlimited scale',
      priceMonthly: 499,
      maxUsers: 1000,
      maxLeads: 1000000,
      maxCampaigns: 1000,
      enabledModules: [
        'lead_management',
        'pipeline',
        'all_integrations',
        'campaign_attribution',
        'communication_timeline',
        'analytics_dashboard',
        'ai_assistant',
        'custom_fields',
        'audit_logs',
      ],
      isActive: true,
    },
  };

  getAllPlans(): PlanDefinition[] {
    return Object.values(this.plans);
  }

  getPlan(plan: SubscriptionPlan): PlanDefinition {
    return this.plans[plan] || this.plans[SubscriptionPlan.STARTER];
  }
}
