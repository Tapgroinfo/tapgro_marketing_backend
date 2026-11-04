import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { schemas } from './db/schema';
import { BackendModules } from './backend/module';
import { GlobalServiceModule } from './backend/globalService/globalService.module';
import { AppController } from './app.controller';
import { DbSeederService } from './db/seeders/seeder.service';
import { buildPinoLoggerParams } from './utils/pino-logger.config';
import { DEFAULT_THROTTLE } from './utils/throttle.constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule.forRoot(buildPinoLoggerParams()),
    ThrottlerModule.forRoot([DEFAULT_THROTTLE]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DB_URL'),
        maxPoolSize: 20,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }),
    }),
    MongooseModule.forFeature(schemas),
    GlobalServiceModule,
    ...BackendModules,
  ],
  controllers: [AppController],
  providers: [
    DbSeederService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
