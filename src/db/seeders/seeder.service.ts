import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Role } from '../schemas/role.schema';
import { User } from '../schemas/user.schema';
import { Permission } from '../schemas/permission.schema';
import { Platform } from '../schemas/platform.schema';
import { PERMISSION_MODULE_DEFINITIONS } from '../../utils/permission-modules.constants';
import { DEFAULT_PLATFORMS } from '../../utils/platform.constants';
import { MessageTemplate } from '../schemas/messageTemplate.schema';
import { DEFAULT_TEMPLATES } from '../../utils/template.constants';

@Injectable()
export class DbSeederService {
  constructor(
    @InjectModel('Role') private readonly roleModel: Model<Role>,
    @InjectModel('User') private readonly userModel: Model<User>,
    @InjectModel('Permission')
    private readonly permissionModel: Model<Permission>,
    @InjectModel('Platform') private readonly platformModel: Model<Platform>,
    @InjectModel(MessageTemplate.name)
    private readonly templateModel: Model<MessageTemplate>,
    private readonly configService: ConfigService,
  ) {}

  async seedAll() {
    await this.seedPermissions();
    await this.seedRoleAndAdmin();
    await this.seedPlatforms();
    await this.seedTemplates();
  }

  /** Inserts missing system templates; never overwrites admin edits. */
  async seedTemplates() {
    for (const template of DEFAULT_TEMPLATES) {
      await this.templateModel.updateOne(
        { channel: template.channel, slug: template.slug },
        {
          $setOnInsert: { subject: '', ...template },
          $set: { isSystem: true },
        },
        { upsert: true },
      );
    }
    console.log(`🌱 ${DEFAULT_TEMPLATES.length} message templates seeded.`);
  }

  async seedPermissions() {
    for (const mod of PERMISSION_MODULE_DEFINITIONS) {
      await this.permissionModel.findOneAndUpdate(
        { slug: mod.slug },
        {
          $set: { name: mod.name, isDeleted: false },
          $setOnInsert: { slug: mod.slug },
        },
        { upsert: true },
      );
    }
    console.log(
      `🌱 ${PERMISSION_MODULE_DEFINITIONS.length} permission modules seeded.`,
    );
  }

  /** Admin role bypasses PermissionsGuard; full flags are stored for UI display. */
  async seedRoleAndAdmin() {
    const fullAccess = PERMISSION_MODULE_DEFINITIONS.map((mod) => ({
      module: mod.slug,
      is_create: true,
      is_view: true,
      is_edit: true,
      is_delete: true,
    }));

    const adminRole = await this.roleModel.findOneAndUpdate(
      { role: 'Admin', isDeleted: false },
      {
        $set: { permissions: fullAccess, isDefault: true },
        $setOnInsert: { role: 'Admin', isDeleted: false },
      },
      { upsert: true, returnDocument: 'after' },
    );

    const email = (
      this.configService.get<string>('DEFAULT_ADMIN_EMAIL') ||
      'admin@tapgro.com'
    ).toLowerCase();
    const password =
      this.configService.get<string>('DEFAULT_ADMIN_PASSWORD') || 'Admin@123';

    const existingAdmin = await this.userModel.exists({ email });
    if (!existingAdmin) {
      await this.userModel.create({
        name: 'System Admin',
        email,
        password: await bcrypt.hash(password, await bcrypt.genSalt()),
        role: adminRole._id,
        status: true,
        isDeleted: false,
      });
      console.log(`🌱 Default admin user seeded with email: ${email}`);
    }
  }

  async seedPlatforms() {
    for (const platform of DEFAULT_PLATFORMS) {
      await this.platformModel.updateOne(
        { slug: platform.slug },
        { $setOnInsert: { ...platform, isDeleted: false } },
        { upsert: true },
      );
    }
    console.log(`🌱 ${DEFAULT_PLATFORMS.length} social platforms seeded.`);
  }
}
