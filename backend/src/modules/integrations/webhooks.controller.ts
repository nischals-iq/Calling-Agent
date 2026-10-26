import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IntegrationsService } from './integrations.service.js';
import { MetaIntegrationService } from './services/meta-integration.service.js';
import { GoogleIntegrationService } from './services/google-integration.service.js';
import { LinkedinIntegrationService } from './services/linkedin-integration.service.js';
import { ChannelType } from '@prisma/client';

@Controller()
export class WebhooksController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly metaService: MetaIntegrationService,
    private readonly googleService: GoogleIntegrationService,
    private readonly linkedinService: LinkedinIntegrationService,
  ) {}

  // ---------------------------------------------------------------------------
  // OAUTH CALLBACK ENDPOINTS
  // ---------------------------------------------------------------------------

  @Get('integrations/meta/callback')
  async metaOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const isBrowser =
      req?.headers?.['accept']?.includes('text/html') ||
      req?.query?.['redirect'] === 'true';

    // 1. Meta returned an error
    if (error || errorDescription) {
      const { redirectUrl, safeErrorMessage } = await this.integrationsService.handleOAuthError(
        ChannelType.META,
        state,
        error || 'access_denied',
        errorDescription || 'Meta authorization was canceled or declined',
      );
      if (isBrowser && res) {
        return res.redirect(redirectUrl);
      }
      throw new BadRequestException(safeErrorMessage);
    }

    // 2. Reject missing state or code
    if (!code || !state) {
      throw new BadRequestException('Authorization code and state are required');
    }

    // 3. Process token exchange
    try {
      const result = await this.integrationsService.handleOAuthCallback(ChannelType.META, code, state);
      if (isBrowser && res && result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }
      return result;
    } catch (err: any) {
      if (isBrowser && res) {
        const { redirectUrl } = await this.integrationsService.handleOAuthError(
          ChannelType.META,
          state,
          'callback_failed',
          err.message || 'OAuth callback failed',
        );
        return res.redirect(redirectUrl);
      }
      throw err;
    }
  }

  @Get('integrations/google/callback')
  async googleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      throw new BadRequestException(`Google OAuth canceled or failed: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException('Authorization code and state are required');
    }
    return this.integrationsService.handleOAuthCallback(ChannelType.GOOGLE, code, state);
  }

  @Get('integrations/linkedin/callback')
  async linkedinOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      throw new BadRequestException(`LinkedIn OAuth canceled or failed: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException('Authorization code and state are required');
    }
    return this.integrationsService.handleOAuthCallback(ChannelType.LINKEDIN, code, state);
  }

  // ---------------------------------------------------------------------------
  // META WEBHOOK ENDPOINTS
  // ---------------------------------------------------------------------------

  @Get('webhooks/meta')
  async verifyMetaWebhook(
    @Query('hub.mode') queryMode: string,
    @Query('hub.verify_token') queryVerifyToken: string,
    @Query('hub.challenge') queryChallenge: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const q = (req?.query || {}) as any;
    const mode = queryMode || q['hub.mode'] || q.hub?.mode;
    const verifyToken = queryVerifyToken || q['hub.verify_token'] || q.hub?.verify_token;
    const challenge = queryChallenge || q['hub.challenge'] || q.hub?.challenge;

    const challengeResponse = await this.metaService.verifyWebhookChallenge(mode, verifyToken, challenge);
    if (res) {
      res.type('text/plain');
    }
    return challengeResponse;
  }

  @Post('webhooks/meta')
  @HttpCode(HttpStatus.OK)
  async receiveMetaWebhook(@Body() payload: any) {
    return this.metaService.processIncomingWebhook(payload);
  }

  // ---------------------------------------------------------------------------
  // GOOGLE ADS WEBHOOK ENDPOINT
  // ---------------------------------------------------------------------------

  @Post('webhooks/google')
  @HttpCode(HttpStatus.OK)
  async receiveGoogleWebhook(@Body() payload: any) {
    await this.googleService.processIncomingWebhook(payload);
    return {};
  }

  // ---------------------------------------------------------------------------
  // LINKEDIN LEAD GEN WEBHOOK ENDPOINT
  // ---------------------------------------------------------------------------

  @Post('webhooks/linkedin')
  @HttpCode(HttpStatus.OK)
  async receiveLinkedinWebhook(@Body() payload: any) {
    return this.linkedinService.processIncomingWebhook(payload);
  }
}
