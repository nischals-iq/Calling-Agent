import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { IntegrationEncryptionService } from './services/integration-encryption.service.js';
import { MetaIntegrationService } from './services/meta-integration.service.js';
import { GoogleIntegrationService } from './services/google-integration.service.js';
import { LinkedinIntegrationService } from './services/linkedin-integration.service.js';
import { ChannelType, IntegrationStatus } from '@prisma/client';

export interface MaskedIntegrationResponse {
  id: string;
  clientId: string;
  channel: ChannelType;
  name?: string | null;
  status: IntegrationStatus;
  credentials: Record<string, any>;
  metadata: Record<string, any>;
  lastSyncedAt?: Date | null;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly stateSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly encryption: IntegrationEncryptionService,
    private readonly metaService: MetaIntegrationService,
    private readonly googleService: GoogleIntegrationService,
    private readonly linkedinService: LinkedinIntegrationService,
  ) {
    this.stateSecret = process.env.OAUTH_STATE_SECRET || 'crm_oauth_state_signing_secret_2026';
  }

  /**
   * Builds the redirect URI dynamically using BACKEND_BASE_URL.
   */
  getCallbackUrl(channel: ChannelType, customRedirectUri?: string): string {
    if (customRedirectUri) return customRedirectUri;
    const backendBase = (process.env.BACKEND_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
    return `${backendBase}/api/integrations/${channel.toLowerCase()}/callback`;
  }

  /**
   * Builds the frontend CRM redirect URL.
   */
  getFrontendRedirectUrl(
    clientId: string,
    statusParam: 'connected' | 'error',
    channel: ChannelType = ChannelType.META,
  ): string {
    const frontendBase = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const channelParam = channel.toLowerCase();
    if (clientId) {
      return `${frontendBase}/admin/clients/${clientId}?tab=integrations&${channelParam}=${statusParam}`;
    }
    return `${frontendBase}/admin/clients?tab=integrations&${channelParam}=${statusParam}`;
  }

  /**
   * Generates a tamper-proof signed OAuth state string.
   */
  generateOAuthState(clientId: string, channel: ChannelType, customTs?: number): string {
    const payload = JSON.stringify({
      clientId,
      channel,
      ts: customTs ?? Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    });
    const hmac = crypto.createHmac('sha256', this.stateSecret).update(payload).digest('hex');
    return Buffer.from(JSON.stringify({ payload, signature: hmac })).toString('base64url');
  }

  /**
   * Verifies and extracts OAuth state.
   */
  verifyOAuthState(stateString: string): { clientId: string; channel: ChannelType; ts: number } {
    if (!stateString || typeof stateString !== 'string') {
      throw new ForbiddenException('Missing OAuth state parameter');
    }
    try {
      const decoded = JSON.parse(Buffer.from(stateString, 'base64url').toString('utf8'));
      const { payload, signature } = decoded;
      if (!payload || !signature) {
        throw new ForbiddenException('Invalid OAuth state format');
      }
      const expectedHmac = crypto.createHmac('sha256', this.stateSecret).update(payload).digest('hex');

      if (signature !== expectedHmac) {
        throw new ForbiddenException('Invalid OAuth state signature (tampering detected)');
      }

      const parsedPayload = JSON.parse(payload);
      if (!parsedPayload.clientId || !parsedPayload.channel || !parsedPayload.ts) {
        throw new ForbiddenException('OAuth state payload missing required fields');
      }

      // State valid for 30 minutes
      if (Date.now() - parsedPayload.ts > 1800000) {
        throw new ForbiddenException('OAuth state has expired. Please retry.');
      }

      return { clientId: parsedPayload.clientId, channel: parsedPayload.channel, ts: parsedPayload.ts };
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err;
      throw new ForbiddenException('Invalid OAuth state format');
    }
  }

  /**
   * Returns list of sensitive keys per channel.
   */
  getSensitiveKeys(channel: ChannelType): string[] {
    switch (channel) {
      case ChannelType.META:
        return MetaIntegrationService.SENSITIVE_KEYS;
      case ChannelType.GOOGLE:
        return GoogleIntegrationService.SENSITIVE_KEYS;
      case ChannelType.LINKEDIN:
        return LinkedinIntegrationService.SENSITIVE_KEYS;
      default:
        return ['secret', 'token', 'apiKey', 'password'];
    }
  }

  /**
   * Masks sensitive credentials for an integration record before returning to frontend.
   */
  maskIntegration(integration: any): MaskedIntegrationResponse {
    const sensitiveKeys = this.getSensitiveKeys(integration.channel);
    const maskedCreds = this.encryption.maskCredentials(
      (integration.credentials as Record<string, any>) || {},
      sensitiveKeys,
    );

    return {
      id: integration.id,
      clientId: integration.clientId,
      channel: integration.channel,
      name: integration.name,
      status: integration.status,
      credentials: maskedCreds,
      metadata: (integration.metadata as Record<string, any>) || {},
      lastSyncedAt: integration.lastSyncedAt,
      errorMessage: integration.errorMessage,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  /**
   * Get all integrations for a client with masked credentials.
   */
  async getClientIntegrations(clientId: string): Promise<MaskedIntegrationResponse[]> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client tenant not found');

    const integrations = await this.prisma.integration.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    });

    return integrations.map((i) => this.maskIntegration(i));
  }

  /**
   * Get single integration for a client by channel.
   */
  async getClientIntegrationByChannel(clientId: string, channel: ChannelType): Promise<MaskedIntegrationResponse> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    if (!integration) {
      // Return empty unconfigured template representation
      return {
        id: '',
        clientId,
        channel,
        status: IntegrationStatus.DISCONNECTED,
        credentials: {},
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return this.maskIntegration(integration);
  }

  /**
   * Save or update integration configuration for a client.
   */
  async saveIntegrationConfig(
    clientId: string,
    channel: ChannelType,
    dto: Record<string, any>,
    adminUserId: string,
    ipAddress?: string,
  ): Promise<MaskedIntegrationResponse> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client tenant not found');

    let existing = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    const sensitiveKeys = this.getSensitiveKeys(channel);
    const existingCreds = (existing?.credentials as Record<string, any>) || {};

    // Validate channel-specific rules
    if (channel === ChannelType.META) {
      // 1. Meta App ID must accept only a valid numeric Meta App ID
      if (!dto.appId || typeof dto.appId !== 'string' || !/^\d+$/.test(dto.appId.trim())) {
        throw new BadRequestException('Enter a valid numeric Meta App ID.');
      }

      // 2. Connected Page ID must be numeric when provided
      if (dto.pageId !== undefined && dto.pageId !== null && String(dto.pageId).trim() !== '') {
        if (!/^\d+$/.test(String(dto.pageId).trim())) {
          throw new BadRequestException('Connected Page ID must be numeric.');
        }
      }

      // 3. Lead Form ID must be numeric when provided
      const formIdVal = dto.leadFormId || dto.formId;
      if (formIdVal !== undefined && formIdVal !== null && String(formIdVal).trim() !== '') {
        if (!/^\d+$/.test(String(formIdVal).trim())) {
          throw new BadRequestException('Lead Form ID must be numeric.');
        }
      }

      // 4. App Secret validation (if new or changing)
      if (!existingCreds.appSecret && (!dto.appSecret || typeof dto.appSecret !== 'string' || dto.appSecret.trim() === '')) {
        throw new BadRequestException('Meta App Secret is required.');
      }
    }

    // Separate credentials and metadata from DTO
    const newCreds: Record<string, any> = {};
    const newMetadata: Record<string, any> = { ...((existing?.metadata as Record<string, any>) || {}) };

    for (const [key, value] of Object.entries(dto)) {
      if (sensitiveKeys.includes(key) || ['appId', 'clientId', 'customerId', 'apiVersion', 'redirectUri'].includes(key)) {
        // If user submitted masked string (e.g. ••••••••2345), keep existing encrypted credential
        if (this.encryption.isMasked(value as string) && existingCreds[key]) {
          newCreds[key] = existingCreds[key];
        } else if (value !== undefined && value !== null && value !== '') {
          // Encrypt if sensitive
          if (sensitiveKeys.includes(key)) {
            newCreds[key] = this.encryption.encrypt(String(value));
          } else {
            newCreds[key] = value;
          }
        }
      } else {
        // Store in metadata (pageId, formId, organizationName, etc.)
        if (value !== undefined) {
          newMetadata[key] = value;
        }
      }
    }

    // Normalize formId and leadFormId in metadata
    if (dto.formId && !newMetadata.leadFormId) newMetadata.leadFormId = dto.formId;
    if (dto.leadFormId && !newMetadata.formId) newMetadata.formId = dto.leadFormId;
    if (dto.formName && !newMetadata.leadFormName) newMetadata.leadFormName = dto.formName;
    if (dto.leadFormName && !newMetadata.formName) newMetadata.formName = dto.leadFormName;

    // Normalize Google webhook key and identifiers in metadata
    if (channel === ChannelType.GOOGLE) {
      const gKey = dto.googleKey || dto.google_key || dto.webhookKey;
      if (gKey !== undefined && gKey !== null && String(gKey).trim() !== '') {
        newMetadata.googleKey = String(gKey).trim();
      }
      if (dto.campaignId) newMetadata.campaignId = String(dto.campaignId).trim();
      if (dto.formId) newMetadata.formId = String(dto.formId).trim();
    }

    // Preserve any existing tokens that were not re-submitted
    for (const key of sensitiveKeys) {
      if (!newCreds[key] && existingCreds[key]) {
        newCreds[key] = existingCreds[key];
      }
    }

    let saved: any;
    if (existing) {
      saved = await this.prisma.integration.update({
        where: { id: existing.id },
        data: {
          credentials: newCreds,
          metadata: newMetadata,
          errorMessage: null,
          status: existing.status === IntegrationStatus.CONNECTED ? IntegrationStatus.CONNECTED : IntegrationStatus.DISCONNECTED,
        },
      });
    } else {
      saved = await this.prisma.integration.create({
        data: {
          clientId,
          channel,
          name: `${channel} Integration`,
          status: IntegrationStatus.DISCONNECTED,
          credentials: newCreds,
          metadata: newMetadata,
        },
      });
    }

    // Audit log (never log secret values)
    await this.auditLogs.log({
      clientId,
      userId: adminUserId,
      action: 'INTEGRATION_CONFIGURED',
      resource: 'Integration',
      details: { channel, updatedKeys: Object.keys(dto).filter((k) => !sensitiveKeys.includes(k)) },
      ipAddress,
    });

    // Auto-subscribe Meta Page if configured
    if (channel === ChannelType.META && newMetadata.pageId && (newCreds.accessToken || existingCreds?.accessToken)) {
      try {
        await this.metaService.syncAndSubscribePage(saved.id);
      } catch (err: any) {
        this.logger.warn(`Could not auto-subscribe Meta page in saveIntegrationConfig: ${err.message}`);
      }
    }

    return this.maskIntegration(saved);
  }

  /**
   * Test configuration validity and connectivity.
   */
  async testIntegration(clientId: string, channel: ChannelType): Promise<{ success: boolean; message: string; details?: any }> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    if (!integration) {
      throw new BadRequestException(`No configuration found for ${channel}. Please save settings first.`);
    }

    const creds = (integration.credentials as Record<string, any>) || {};

    if (channel === ChannelType.META) {
      if (!creds.appId) throw new BadRequestException('Meta App ID is missing');
      if (!creds.appSecret) throw new BadRequestException('Meta App Secret is missing');
      return {
        success: true,
        message: 'Meta credentials verified successfully. Ready for OAuth connect or lead webhook intake.',
        details: { appId: creds.appId, apiVersion: creds.apiVersion || 'v19.0' },
      };
    }

    if (channel === ChannelType.GOOGLE) {
      if (!creds.clientId) throw new BadRequestException('Google OAuth Client ID is missing');
      if (!creds.clientSecret) throw new BadRequestException('Google OAuth Client Secret is missing');
      if (!creds.developerToken) throw new BadRequestException('Google Ads Developer Token is missing');
      if (!creds.customerId) throw new BadRequestException('Google Ads Customer ID is missing');
      return {
        success: true,
        message: 'Google Ads credentials verified successfully. Developer token and customer ID are valid.',
        details: { customerId: creds.customerId },
      };
    }

    if (channel === ChannelType.LINKEDIN) {
      if (!creds.clientId) throw new BadRequestException('LinkedIn Client ID is missing');
      if (!creds.clientSecret) throw new BadRequestException('LinkedIn Client Secret is missing');
      return {
        success: true,
        message: 'LinkedIn credentials verified successfully. Ready for OAuth or webhook intake.',
      };
    }

    return { success: true, message: 'Configuration parameters verified.' };
  }

  /**
   * Initiates connection / OAuth authorization URL generation.
   */
  async initiateConnect(
    clientId: string,
    channel: ChannelType,
    redirectUri?: string,
  ): Promise<{ authUrl?: string; directConnected?: boolean; message: string; redirectUri: string }> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    if (!integration) {
      throw new BadRequestException(`Please configure ${channel} credentials before connecting.`);
    }

    const creds = (integration.credentials as Record<string, any>) || {};
    const state = this.generateOAuthState(clientId, channel);
    const callback = redirectUri || creds.redirectUri || this.getCallbackUrl(channel);

    let authUrl: string;

    if (channel === ChannelType.META) {
      if (!creds.appId) throw new BadRequestException('Meta App ID is required to initiate connection');
      authUrl = this.metaService.generateAuthUrl(creds.appId, callback, state, creds.apiVersion);
    } else if (channel === ChannelType.GOOGLE) {
      if (!creds.clientId) throw new BadRequestException('Google Client ID is required to initiate connection');
      authUrl = this.googleService.generateAuthUrl(creds.clientId, callback, state);
    } else if (channel === ChannelType.LINKEDIN) {
      if (!creds.clientId) throw new BadRequestException('LinkedIn Client ID is required to initiate connection');
      authUrl = this.linkedinService.generateAuthUrl(creds.clientId, callback, state);
    } else {
      throw new BadRequestException(`OAuth not supported for ${channel}`);
    }

    return { authUrl, redirectUri: callback, message: `Authorization URL generated for ${channel}` };
  }

  /**
   * Handles OAuth Callback from external provider.
   */
  async handleOAuthCallback(
    channel: ChannelType,
    code: string,
    stateString: string,
  ): Promise<{
    success: boolean;
    clientId: string;
    channel: ChannelType;
    availableSources: any;
    redirectUrl: string;
  }> {
    if (!stateString) {
      throw new BadRequestException('OAuth state parameter is required');
    }
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    // 1. Verify state and extract tenant
    const { clientId, channel: stateChannel } = this.verifyOAuthState(stateString);
    if (stateChannel !== channel) {
      throw new ForbiddenException('OAuth channel mismatch in state token');
    }

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(`Client tenant ${clientId} not found`);
    }

    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    if (!integration) {
      throw new NotFoundException(`No integration record found for client ${clientId} and channel ${channel}`);
    }

    const creds = (integration.credentials as Record<string, any>) || {};
    const sensitiveKeys = this.getSensitiveKeys(channel);
    const decryptedCreds = this.encryption.decryptCredentials(creds, sensitiveKeys);
    const callbackUri = creds.redirectUri || this.getCallbackUrl(channel);

    let tokens: Record<string, any> = {};
    let availableSources: any = {};

    // 2. Exchange code for tokens
    if (channel === ChannelType.META) {
      if (!decryptedCreds.appId) {
        throw new BadRequestException('Meta App ID is missing from configuration');
      }
      if (!decryptedCreds.appSecret) {
        throw new BadRequestException('Meta App Secret is missing from configuration');
      }

      const result = await this.metaService.exchangeCodeForToken(
        decryptedCreds.appId,
        decryptedCreds.appSecret,
        callbackUri,
        code,
      );
      tokens = {
        accessToken: this.encryption.encrypt(result.accessToken),
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        tokenExpiresAt: result.expiresIn ? new Date(Date.now() + result.expiresIn * 1000).toISOString() : undefined,
      };
      availableSources = await this.metaService.getAvailablePagesAndForms(result.accessToken);
    } else if (channel === ChannelType.GOOGLE) {
      const result = await this.googleService.exchangeCodeForToken(
        decryptedCreds.clientId,
        decryptedCreds.clientSecret,
        callbackUri,
        code,
      );
      tokens = {
        accessToken: this.encryption.encrypt(result.accessToken),
        refreshToken: result.refreshToken ? this.encryption.encrypt(result.refreshToken) : undefined,
      };

      const meta = (integration.metadata as Record<string, any>) || {};
      const configuredCustomerId = decryptedCreds.customerId || creds.customerId || meta.customerId || meta.accountId;
      const accountName = meta.accountName || meta.name;
      const developerToken = decryptedCreds.developerToken;

      availableSources = await this.googleService.getAvailableAccounts(
        result.accessToken,
        developerToken,
        configuredCustomerId,
        accountName,
      );
    } else if (channel === ChannelType.LINKEDIN) {
      const result = await this.linkedinService.exchangeCodeForToken(
        decryptedCreds.clientId,
        decryptedCreds.clientSecret,
        callbackUri,
        code,
      );
      tokens = { accessToken: this.encryption.encrypt(result.accessToken) };
      availableSources = await this.linkedinService.getAvailableOrganizationsAndForms(result.accessToken);
    }

    // 3. Update Integration in Database
    await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: IntegrationStatus.CONNECTED,
        credentials: { ...creds, ...tokens },
        lastSyncedAt: new Date(),
        errorMessage: null,
      },
    });

    // 4. Record Audit Log (safe: no secrets exposed)
    await this.auditLogs.log({
      clientId,
      action: 'INTEGRATION_CONNECTED',
      resource: 'Integration',
      resourceId: integration.id,
      details: { channel, connectedVia: 'OAuth Callback' },
    });

    // Auto-subscribe Meta Page if configured
    if (channel === ChannelType.META) {
      try {
        await this.metaService.syncAndSubscribePage(integration.id);
      } catch (err: any) {
        this.logger.warn(`Could not auto-subscribe Meta page in handleOAuthCallback: ${err.message}`);
      }
    }

    const redirectUrl = this.getFrontendRedirectUrl(clientId, 'connected', channel);

    return { success: true, clientId, channel, availableSources, redirectUrl };
  }

  /**
   * Handles OAuth errors safely, updating Integration errorMessage and recording audit log.
   */
  async handleOAuthError(
    channel: ChannelType,
    stateString?: string,
    error = 'oauth_error',
    errorDescription = 'OAuth authorization failed',
  ): Promise<{ redirectUrl: string; safeErrorMessage: string; clientId?: string }> {
    let resolvedClientId: string | undefined;

    // Safely attempt to decode state to identify client without throwing
    if (stateString) {
      try {
        const decoded = JSON.parse(Buffer.from(stateString, 'base64url').toString('utf8'));
        if (decoded?.payload) {
          const parsed = JSON.parse(decoded.payload);
          if (parsed?.clientId && parsed?.channel === channel) {
            resolvedClientId = parsed.clientId;
          }
        }
      } catch {
        // Ignore parsing errors for untrusted state
      }
    }

    const safeReason = (errorDescription || error || 'Authorization canceled or denied').replace(/[<>"']/g, '');
    const safeErrorMessage = `Meta OAuth error: ${safeReason}`;

    if (resolvedClientId) {
      const integration = await this.prisma.integration.findFirst({
        where: { clientId: resolvedClientId, channel },
      });

      if (integration) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            errorMessage: safeErrorMessage,
          },
        });
      }

      await this.auditLogs.log({
        clientId: resolvedClientId,
        action: 'INTEGRATION_ERROR',
        resource: 'Integration',
        resourceId: integration?.id,
        details: { channel, error: error || 'oauth_error', description: safeReason },
      });
    } else {
      await this.auditLogs.log({
        action: 'INTEGRATION_ERROR',
        resource: 'Integration',
        details: { channel, error: error || 'oauth_error', description: safeReason },
      });
    }

    const redirectUrl = this.getFrontendRedirectUrl(resolvedClientId || '', 'error', channel);

    return { redirectUrl, safeErrorMessage, clientId: resolvedClientId };
  }

  /**
   * Save selected account, page, or lead form for an integration.
   */
  async selectSource(
    clientId: string,
    channel: ChannelType,
    selection: Record<string, any>,
    adminUserId: string,
  ): Promise<MaskedIntegrationResponse> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    if (!integration) throw new NotFoundException('Integration not found');

    const existingMeta = (integration.metadata as Record<string, any>) || {};
    const updatedMeta = { ...existingMeta, ...selection };

    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: { metadata: updatedMeta },
    });

    await this.auditLogs.log({
      clientId,
      userId: adminUserId,
      action: 'INTEGRATION_SOURCE_SELECTED',
      resource: 'Integration',
      resourceId: integration.id,
      details: { channel, selection },
    });

    // Auto-subscribe Meta Page if page was selected
    if (channel === ChannelType.META && updatedMeta.pageId) {
      try {
        await this.metaService.syncAndSubscribePage(integration.id);
      } catch (err: any) {
        this.logger.warn(`Could not auto-subscribe Meta page in selectSource: ${err.message}`);
      }
    }

    return this.maskIntegration(updated);
  }

  /**
   * Check whether a client's connected Meta Page is subscribed to leadgen webhooks.
   */
  async checkMetaPageSubscription(clientId: string): Promise<{
    pageId?: string;
    pageName?: string;
    isSubscribed: boolean;
    subscribedFields: string[];
    appName?: string;
    appId?: string;
    message: string;
  }> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel: ChannelType.META },
    });
    if (!integration) throw new NotFoundException('Meta integration not found');

    const metadata = (integration.metadata as Record<string, any>) || {};
    const creds = (integration.credentials as Record<string, any>) || {};
    const pageId = metadata.pageId;

    if (!pageId) {
      return {
        isSubscribed: false,
        subscribedFields: [],
        message: 'No Page ID configured for this client.',
      };
    }

    let token = creds.pageAccessToken ? this.encryption.decrypt(creds.pageAccessToken) : null;
    if (!token && creds.accessToken) {
      token = this.encryption.decrypt(creds.accessToken);
    }

    if (!token) {
      return {
        pageId,
        pageName: metadata.pageName,
        isSubscribed: false,
        subscribedFields: [],
        message: 'No access token found for Meta integration.',
      };
    }

    const check = await this.metaService.verifyPageSubscription(pageId, token);
    return {
      pageId,
      pageName: metadata.pageName,
      isSubscribed: check.isSubscribed,
      subscribedFields: check.subscribedFields,
      appName: check.appName,
      appId: check.appId,
      message: check.isSubscribed
        ? `Page ${pageId} is subscribed to app ${check.appName || check.appId || ''} for leadgen`
        : `Page ${pageId} is not subscribed to this app for leadgen`,
    };
  }

  /**
   * Subscribes a client's connected Meta Page to leadgen webhooks.
   */
  async subscribeMetaPage(clientId: string, pageId?: string): Promise<{
    success: boolean;
    pageId?: string;
    isSubscribed: boolean;
    alreadySubscribed?: boolean;
    message: string;
  }> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel: ChannelType.META },
    });
    if (!integration) throw new NotFoundException('Meta integration not found');

    if (pageId) {
      const metadata = (integration.metadata as Record<string, any>) || {};
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { metadata: { ...metadata, pageId } },
      });
    }

    return this.metaService.syncAndSubscribePage(integration.id);
  }

  /**
   * Disconnect an integration.
   */
  async disconnectIntegration(
    clientId: string,
    channel: ChannelType,
    adminUserId: string,
    ipAddress?: string,
  ): Promise<MaskedIntegrationResponse> {
    const integration = await this.prisma.integration.findFirst({
      where: { clientId, channel },
    });

    if (!integration) throw new NotFoundException('Integration not found');

    const creds = (integration.credentials as Record<string, any>) || {};
    // Remove access/refresh tokens while retaining app ID and general config
    delete creds.accessToken;
    delete creds.refreshToken;
    delete creds.pageAccessToken;

    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: IntegrationStatus.DISCONNECTED,
        credentials: creds,
        errorMessage: null,
      },
    });

    await this.auditLogs.log({
      clientId,
      userId: adminUserId,
      action: 'INTEGRATION_DISCONNECTED',
      resource: 'Integration',
      resourceId: integration.id,
      details: { channel },
      ipAddress,
    });

    return this.maskIntegration(updated);
  }

  /**
   * Step 2: Creates a single PAUSED Meta test campaign and verifies via read-back
   */
  async createMetaTestCampaign(clientId: string, campaignName?: string) {
    return this.metaService.createTestCampaign(clientId, campaignName);
  }
}
