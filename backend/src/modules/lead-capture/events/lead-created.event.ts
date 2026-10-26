import { ChannelType } from '@prisma/client';

export class LeadCreatedEvent {
  eventId: string;
  leadId: string;
  clientId: string;
  source: ChannelType;
  createdAt: Date;

  constructor(data: {
    eventId: string;
    leadId: string;
    clientId: string;
    source: ChannelType;
    createdAt: Date;
  }) {
    this.eventId = data.eventId;
    this.leadId = data.leadId;
    this.clientId = data.clientId;
    this.source = data.source;
    this.createdAt = data.createdAt;
  }
}
