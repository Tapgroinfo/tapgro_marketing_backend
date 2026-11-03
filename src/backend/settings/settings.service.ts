import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSettingsDocument } from '../../db/schemas/setting.schema';
import { GlobalService } from '../globalService/global.service';
import { auditAction } from '../../utils/auditActionEnum';
import { auditActionDes } from '../../utils/auditActionDesEnum';
import { auditType } from '../../utils/auditTypeEnum';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_KEY = 'default';
const MASK = '********';

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
    const plain = doc.toObject();

    if (dto.company) {
      doc.set('company', { ...plain.company, ...dto.company });
    }
    if (dto.email) {
      const next = { ...plain.email, ...dto.email };
      if (this.isMaskedSecret(dto.email.password)) {
        next.password = plain.email?.password || '';
      }
      doc.set('email', next);
    }
    if (dto.legal) {
      doc.set('legal', { ...plain.legal, ...dto.legal });
    }
    if (dto.socialProvider) {
      const current = plain.socialProvider || {};
      const next = { ...current, ...dto.socialProvider };
      if (this.isMaskedSecret(dto.socialProvider.apiKey)) {
        next.apiKey = current.apiKey || '';
      }
      if (this.isMaskedSecret(dto.socialProvider.webhookSecret)) {
        next.webhookSecret = current.webhookSecret || '';
      }
      doc.set('socialProvider', next);
    }

    await doc.save();

    await this.globalService.createAuditTrail(
      {
        updatedBy: user_id,
        action: auditAction.UPDATE,
        description: auditActionDes.SETTINGS_UPDATED,
        auditType: auditType.SETTINGS_LOG,
      },
      { sections: Object.keys(dto) },
    );

    return {
      success: true,
      message: 'Settings updated successfully',
      data: this.buildSettingsData(doc),
    };
  }

  /** No-auth subset safe for login pages / public sites. */
  async getPublicSettings() {
    const doc = await this.getOrCreate();
    return {
      success: true,
      data: {
        company: {
          name: doc.company?.name || 'TapGro',
          websiteUrl: doc.company?.websiteUrl || '',
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
    const plain = doc.toObject();
    return {
      company: plain.company,
      email: {
        ...plain.email,
        password: this.maskSecret(plain.email?.password),
      },
      legal: plain.legal,
      socialProvider: {
        ...plain.socialProvider,
        apiKey: this.maskSecret(plain.socialProvider?.apiKey),
        webhookSecret: this.maskSecret(plain.socialProvider?.webhookSecret),
      },
    };
  }

  private isMaskedSecret(value?: string): boolean {
    return !value || value === MASK || value.trim() === '';
  }

  private maskSecret(value?: string | null): string {
    return value ? MASK : '';
  }
}
