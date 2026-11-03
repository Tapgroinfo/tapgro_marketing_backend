import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DbSeederService } from './seeders/seeder.service';

async function bootstrap() {
  console.log('🌱 Starting database seeding context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(DbSeederService);
  const target = process.argv[2]?.toLowerCase();

  try {
    if (!target || target === 'all') {
      await seeder.seedAll();
    } else if (target === 'admin') {
      await seeder.seedPermissions();
      await seeder.seedRoleAndAdmin();
    } else if (target === 'platform') {
      await seeder.seedPlatforms();
    } else {
      console.error(
        `❌ Unknown target: "${target}". Use: all | admin | platform`,
      );
      process.exitCode = 1;
      return;
    }
    console.log('🌱 Seeding process completed successfully.');
  } catch (error) {
    console.error('❌ Seeding process encountered an error:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
void bootstrap();
