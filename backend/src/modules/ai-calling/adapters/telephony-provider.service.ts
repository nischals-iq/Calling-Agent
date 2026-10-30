import { Injectable, Logger } from '@nestjs/common';
import { TelephonyProvider } from './telephony-provider.interface.js';
import { MockTelephonyAdapter } from './mock-telephony.adapter.js';
import { ExotelAdapter } from './exotel.adapter.js';

@Injectable()
export class TelephonyProviderService {
  private readonly logger = new Logger(TelephonyProviderService.name);

  constructor(
    private readonly mockAdapter: MockTelephonyAdapter,
    private readonly exotelAdapter: ExotelAdapter,
  ) {}

  /**
   * Returns active telephony provider according to configuration or explicit override.
   * By default, returns MOCK_TELEPHONY unless TELEPHONY_PROVIDER=EXOTEL and EXOTEL_ENABLED=true.
   */
  getProvider(overrideName?: string): TelephonyProvider {
    const configuredProvider = (
      overrideName ||
      process.env.TELEPHONY_PROVIDER ||
      'MOCK_TELEPHONY'
    ).toUpperCase();

    if (configuredProvider === 'EXOTEL') {
      const isEnabled = process.env.EXOTEL_ENABLED === 'true';
      if (!isEnabled) {
        this.logger.warn(
          `[TELEPHONY PROVIDER] EXOTEL requested but EXOTEL_ENABLED is not 'true'. Falling back to MOCK_TELEPHONY for safety.`,
        );
        return this.mockAdapter;
      }
      return this.exotelAdapter;
    }

    return this.mockAdapter;
  }

  getMockAdapter(): MockTelephonyAdapter {
    return this.mockAdapter;
  }

  getExotelAdapter(): ExotelAdapter {
    return this.exotelAdapter;
  }
}
