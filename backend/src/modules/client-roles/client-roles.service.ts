import { Injectable } from '@nestjs/common';
import {
  ROLE_DEFAULT_PERMISSIONS,
  PermissionModule,
  PermissionAction,
} from '../../common/permissions/permissions.constants.js';

export interface RoleDetail {
  id: string;
  name: string;
  description: string;
  scope: string;
  badgeColor: string;
  defaultPermissions: string[];
}

@Injectable()
export class ClientRolesService {
  getRoles(): RoleDetail[] {
    return [
      {
        id: 'CLIENT_ADMIN',
        name: 'Client Admin',
        description:
          'Full administrative control over tenant CRM, team users, integrations, reports, and tenant settings.',
        scope: 'Full Tenant Access',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        defaultPermissions: ROLE_DEFAULT_PERMISSIONS['CLIENT_ADMIN'],
      },
      {
        id: 'SALES_MANAGER',
        name: 'Sales Manager',
        description:
          'Manages sales leads, lead assignments, deals pipeline, team performance, and conversion reports.',
        scope: 'Leads, Pipeline, Team Activity & Reports',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        defaultPermissions: ROLE_DEFAULT_PERMISSIONS['SALES_MANAGER'],
      },
      {
        id: 'SALES_EXECUTIVE',
        name: 'Sales Executive',
        description:
          'Works assigned leads, executes follow-ups, calls, notes, deal updates, and task milestones.',
        scope: 'Assigned Leads, Pipeline & Tasks',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        defaultPermissions: ROLE_DEFAULT_PERMISSIONS['SALES_EXECUTIVE'],
      },
      {
        id: 'MARKETING_USER',
        name: 'Marketing User',
        description:
          'Manages ad campaigns, lead sources, marketing attribution channels, and acquisition analytics.',
        scope: 'Campaigns, Sources & Marketing Reports',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        defaultPermissions: ROLE_DEFAULT_PERMISSIONS['MARKETING_USER'],
      },
      {
        id: 'VIEWER',
        name: 'Viewer',
        description:
          'Read-only observer access to dashboards, lead summaries, and permitted CRM telemetry.',
        scope: 'Read-only Dashboards & Permitted Reports',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        defaultPermissions: ROLE_DEFAULT_PERMISSIONS['VIEWER'],
      },
    ];
  }

  getPermissionMatrix() {
    const modules = [
      {
        id: PermissionModule.USERS,
        name: 'Client Users',
        actions: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
        ],
      },
      {
        id: PermissionModule.TEAMS,
        name: 'Teams',
        actions: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
          PermissionAction.ASSIGN,
        ],
      },
      {
        id: PermissionModule.LEADS,
        name: 'Leads & Contacts',
        actions: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
          PermissionAction.ASSIGN,
          PermissionAction.EXPORT,
        ],
      },
      {
        id: PermissionModule.PIPELINE,
        name: 'Deals & Pipeline',
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
      },
      {
        id: PermissionModule.CAMPAIGNS,
        name: 'Campaigns & Sources',
        actions: [
          PermissionAction.VIEW,
          PermissionAction.CREATE,
          PermissionAction.EDIT,
          PermissionAction.DELETE,
        ],
      },
      {
        id: PermissionModule.REPORTS,
        name: 'Reports & Analytics',
        actions: [PermissionAction.VIEW, PermissionAction.EXPORT],
      },
      {
        id: PermissionModule.SETTINGS,
        name: 'Tenant Settings',
        actions: [PermissionAction.VIEW, PermissionAction.EDIT],
      },
      {
        id: PermissionModule.ACTIVITY_LOGS,
        name: 'Activity Logs',
        actions: [PermissionAction.VIEW, PermissionAction.EXPORT],
      },
    ];

    const roles = this.getRoles();

    return {
      modules,
      roles,
    };
  }
}
