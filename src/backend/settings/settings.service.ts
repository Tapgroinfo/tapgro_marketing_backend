import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmailSmtpSettings,
  SmsGatewaySettings,
  SocialProviderSettings,
  SystemConfigSettings,
  SystemSettingsDocument,
  WhatsappGatewaySettings,
} from '../../db/schemas/setting.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditActionDes } from '../../utils/auditActionDesEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_KEY = 'default';
const MASK = '********';

type Section = keyof UpdateSettingsDto;

/** Fields returned as ******** and kept unchanged when sent blank / masked. */
const SECRET_FIELDS: Partial<Record<Section, string[]>> = {
  email: ['password'],
  socialProvider: ['apiKey', 'webhookSecret'],
  sms: ['password'],
  whatsapp: ['apiKey'],
};

const SECTIONS: Section[] = [
  'company',
  'email',
  'legal',
  'socialProvider',
  'sms',
  'whatsapp',
  'system',
];

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel('SystemSettings')
    private readonly settingsModel: Model<SystemSettingsDocument>,
    private readonly globalService: GlobalService,
  ) {}

  async getOrCreate(): Promise<SystemSettingsDocument> {
    const doc = await this.settingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $setOnInsert: { key: SETTINGS_KEY } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    return doc;
  }

  async getAll() {
    const doc = await this.getOrCreate();
    return {
      success: true,
      message: 'Settings retrieved successfully',
      data: this.buildSettingsData(doc),
    };
  }

  async update(dto: UpdateSettingsDto, user_id: string) {
    const doc = await this.getOrCreate();
    const plain = doc.toObject() as unknown as Record<
      string,
      Record<string, unknown> | undefined
    >;

    const updatedSections: string[] = [];
    for (const section of SECTIONS) {
      const incoming = dto[section] as Record<string, unknown> | undefined;
      if (!incoming) continue;

      const current = plain[section] || {};
      const next = { ...current, ...incoming };
      for (const field of SECRET_FIELDS[section] || []) {
        if (this.isMaskedSecret(incoming[field] as string | undefined)) {
          next[field] = current[field] || '';
        }
      }
      doc.set(section, next);
      updatedSections.push(section);
    }

    await doc.save();

    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action: auditAction.UPDATE,
        description: auditActionDes.SETTINGS_UPDATED,
        auditType: auditType.SETTINGS_LOG,
      },
      { sections: updatedSections },
    );

    return {
      success: true,
      message: 'Settings updated successfully',
      data: this.buildSettingsData(doc),
    };
  }

  /** No-auth subset safe for login pages / public sites / apps. */
  async getPublicSettings() {
    const doc = await this.getOrCreate();
    const system = doc.system || ({} as SystemConfigSettings);
    return {
      success: true,
      data: {
        company: {
          name: doc.company?.name || 'TapGro',
          websiteUrl: doc.company?.websiteUrl || '',
        },
        system: {
          maintenanceMode: system.maintenanceMode ?? false,
          maintenanceMessage: system.maintenanceMessage || '',
          timezone: system.timezone,
          currency: system.currency,
          currencySymbol: system.currencySymbol,
          dateFormat: system.dateFormat,
          androidVersion: system.androidVersion,
          iosVersion: system.iosVersion,
          forceUpdate: system.forceUpdate ?? false,
          playStoreUrl: system.playStoreUrl || '',
          appStoreUrl: system.appStoreUrl || '',
        },
        legal: {
          privacyPolicyUpdatedAt: doc.legal?.privacyPolicyUpdatedAt || '',
          termsAndConditionsUpdatedAt:
            doc.legal?.termsAndConditionsUpdatedAt || '',
          privacyPolicyUrl: '/api/public/v1/legal/privacy-policy',
          termsAndConditionsUrl: '/api/public/v1/legal/terms-and-conditions',
        },
      },
    };
  }

  async getPublicLegal() {
    const doc = await this.getOrCreate();
    return {
      success: true,
      message: 'Legal documents retrieved successfully',
      data: {
        company: doc.company?.name || 'TapGro',
        privacy_policy: this.privacyPolicyPayload(doc),
        terms_and_conditions: this.termsPayload(doc),
      },
    };
  }

  async getPublicPrivacyPolicy() {
    const doc = await this.getOrCreate();
    return {
      success: true,
      message: 'Privacy policy retrieved successfully',
      data: this.privacyPolicyPayload(doc),
    };
  }

  async getPublicTermsAndConditions() {
    const doc = await this.getOrCreate();
    return {
      success: true,
      message: 'Terms and conditions retrieved successfully',
      data: this.termsPayload(doc),
    };
  }

  /** Internal (unmasked) — for senders and integrations only. */
  async getEmailSmtpConfig(): Promise<Partial<EmailSmtpSettings>> {
    return (await this.getOrCreate()).toObject().email || {};
  }

  async getSmsConfig(): Promise<Partial<SmsGatewaySettings>> {
    return (await this.getOrCreate()).toObject().sms || {};
  }

  async getWhatsappConfig(): Promise<Partial<WhatsappGatewaySettings>> {
    return (await this.getOrCreate()).toObject().whatsapp || {};
  }

  async getSocialProviderConfig(): Promise<Partial<SocialProviderSettings>> {
    return (await this.getOrCreate()).toObject().socialProvider || {};
  }

  async getCompanyName(): Promise<string> {
    return (await this.getOrCreate()).company?.name || 'TapGro';
  }

  private privacyPolicyPayload(doc: SystemSettingsDocument) {
    return {
      title: 'Privacy Policy',
      updated_at: doc.legal?.privacyPolicyUpdatedAt || '',
      html: doc.legal?.privacyPolicyHtml || '',
    };
  }

  private termsPayload(doc: SystemSettingsDocument) {
    return {
      title: 'Terms and Conditions',
      updated_at: doc.legal?.termsAndConditionsUpdatedAt || '',
      html: doc.legal?.termsAndConditionsHtml || '',
    };
  }

  private buildSettingsData(doc: SystemSettingsDocument) {
    const plain = doc.toObject() as unknown as Record<
      string,
      Record<string, unknown> | undefined
    >;
    const data: Record<string, unknown> = {};
    for (const section of SECTIONS) {
      const value = { ...(plain[section] || {}) };
      for (const field of SECRET_FIELDS[section] || []) {
        value[field] = this.maskSecret(value[field] as string | undefined);
      }
      data[section] = value;
    }
    return data;
  }

  private isMaskedSecret(value?: string): boolean {
    return !value || value === MASK || value.trim() === '';
  }

  private maskSecret(value?: string | null): string {
    return value ? MASK : '';
  }
}
