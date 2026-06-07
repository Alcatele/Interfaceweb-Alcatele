// WhatsApp Integration Service
// Supports both WhatsApp Business API and Twilio

export type WhatsAppProvider = 'business-api' | 'twilio';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'video' | 'document' | 'audio';
  mediaUrl?: string;
}

export interface WhatsAppContact {
  id: string;
  phoneNumber: string;
  displayName: string;
  profilePicture?: string;
  lastMessageTime?: string;
  status: 'active' | 'inactive';
}

export interface WhatsAppQueueGroup {
  id: string;
  name: string;
  description: string;
  agents: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppProviderConfig {
  provider: WhatsAppProvider;
  businessApiConfig?: {
    phoneNumberId: string;
    accessToken: string;
    apiVersion: string;
  };
  twilioConfig?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
}

class WhatsAppService {
  private provider: WhatsAppProvider = 'twilio';
  private config: WhatsAppProviderConfig | null = null;
  private baseURL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

  /**
   * Initialize WhatsApp service with provider configuration
   */
  async initialize(config: WhatsAppProviderConfig): Promise<void> {
    this.provider = config.provider;
    this.config = config;

    try {
      const response = await fetch(`${this.baseURL}/whatsapp/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'alcatele-cloud',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize WhatsApp: ${response.statusText}`);
      }
    } catch (error) {
      console.error('WhatsApp initialization error:', error);
      throw error;
    }
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(
    to: string,
    body: string,
    mediaUrl?: string,
  ): Promise<WhatsAppMessage> {
    const payload = {
      to,
      body,
      mediaUrl,
      provider: this.provider,
    };

    try {
      const response = await fetch(`${this.baseURL}/whatsapp/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'alcatele-cloud',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history with a contact
   */
  async getConversation(
    phoneNumber: string,
    limit: number = 50,
  ): Promise<WhatsAppMessage[]> {
    try {
      const response = await fetch(
        `${this.baseURL}/whatsapp/conversations/${phoneNumber}?limit=${limit}`,
        {
          headers: {
            'X-Tenant-ID': 'alcatele-cloud',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  /**
   * Get all active contacts/chats
   */
  async getContacts(): Promise<WhatsAppContact[]> {
    try {
      const response = await fetch(`${this.baseURL}/whatsapp/contacts`, {
        headers: {
          'X-Tenant-ID': 'alcatele-cloud',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  /**
   * Create a new queue/group for WhatsApp support
   */
  async createQueueGroup(group: Omit<WhatsAppQueueGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<WhatsAppQueueGroup> {
    try {
      const response = await fetch(`${this.baseURL}/whatsapp/queue-groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': 'alcatele-cloud',
        },
        body: JSON.stringify(group),
      });

      if (!response.ok) {
        throw new Error(`Failed to create queue group: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating queue group:', error);
      throw error;
    }
  }

  /**
   * Get all queue groups
   */
  async getQueueGroups(): Promise<WhatsAppQueueGroup[]> {
    try {
      const response = await fetch(`${this.baseURL}/whatsapp/queue-groups`, {
        headers: {
          'X-Tenant-ID': 'alcatele-cloud',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch queue groups: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching queue groups:', error);
      throw error;
    }
  }

  /**
   * Update a queue group
   */
  async updateQueueGroup(
    groupId: string,
    updates: Partial<WhatsAppQueueGroup>,
  ): Promise<WhatsAppQueueGroup> {
    try {
      const response = await fetch(
        `${this.baseURL}/whatsapp/queue-groups/${groupId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'alcatele-cloud',
          },
          body: JSON.stringify(updates),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update queue group: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating queue group:', error);
      throw error;
    }
  }

  /**
   * Assign a contact to a queue group
   */
  async assignToQueueGroup(
    contactId: string,
    queueGroupId: string,
  ): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseURL}/whatsapp/queue-groups/${queueGroupId}/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'alcatele-cloud',
          },
          body: JSON.stringify({ contactId }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to assign to queue group: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error assigning to queue group:', error);
      throw error;
    }
  }

  /**
   * Get WhatsApp reports
   */
  async getReports(
    startDate: string,
    endDate: string,
    groupId?: string,
  ): Promise<WhatsAppReports> {
    const params = new URLSearchParams({
      startDate,
      endDate,
      ...(groupId && { groupId }),
    });

    try {
      const response = await fetch(
        `${this.baseURL}/whatsapp/reports?${params.toString()}`,
        {
          headers: {
            'X-Tenant-ID': 'alcatele-cloud',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch reports: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(
    groupId: string,
  ): Promise<WhatsAppQueueMetrics> {
    try {
      const response = await fetch(
        `${this.baseURL}/whatsapp/queue-groups/${groupId}/metrics`,
        {
          headers: {
            'X-Tenant-ID': 'alcatele-cloud',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch queue metrics: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching queue metrics:', error);
      throw error;
    }
  }
}

export interface WhatsAppReports {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  messagesByHour: Array<{
    hour: string;
    count: number;
  }>;
  messagesByQueueGroup: Array<{
    groupId: string;
    groupName: string;
    count: number;
    averageResponseTime: number;
  }>;
  topContacts: WhatsAppContact[];
  slaMetrics: {
    totalMessages: number;
    withinSla: number;
    slaPercentage: number;
  };
}

export interface WhatsAppQueueMetrics {
  queueGroupId: string;
  queueGroupName: string;
  activeChats: number;
  waitingChats: number;
  averageWaitTime: number;
  averageResponseTime: number;
  totalMessagesHandled: number;
  agentsOnline: number;
  agentsOnBreak: number;
  slaPercentage: number;
}

export const whatsappService = new WhatsAppService();
