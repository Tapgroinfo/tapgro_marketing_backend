import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import basicAuth from 'express-basic-auth';
import helmet from 'helmet';
import compression from 'compression';
import { join } from 'path';
import { AppModule } from './app.module';
import { BackendModules } from './backend/module';
import { LOCAL_UPLOAD_DIR } from './backend/upload/upload.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
    rawBody: true,
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('HTTP_PORT') || 3000;
  const swaggerUser = configService.get<string>('SWAGGER_USER') || 'admin';
  const swaggerPassword =
    configService.get<string>('SWAGGER_PASSWORD') || 'admin';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    }),
  );

  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { limit: '10mb', extended: true });

  // Behind nginx / a load balancer: real client IP for rate limits + login history
  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }

  app.useStaticAssets(join(process.cwd(), LOCAL_UPLOAD_DIR), {
    prefix: `/${LOCAL_UPLOAD_DIR}/`,
  });

  app.use(
    ['/swagger/backend'],
    basicAuth({
      challenge: true,
      users: { [swaggerUser]: swaggerPassword },
    }),
  );

  const swaggerOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
      deepLinking: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  };

  const backendSwaggerConfig = new DocumentBuilder()
    .setTitle('TapGro Marketing — Admin API')
    .setDescription(
      'Admin panel APIs (`/api/backend/v1`) and public APIs (`/api/public/v1`).\n\n**Start here:** `POST /api/backend/v1/adminLogin` → Authorize with `backendBearerAuth`.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'backendBearerAuth',
    )
    .build();

  SwaggerModule.setup(
    'swagger/backend',
    app,
    SwaggerModule.createDocument(app, backendSwaggerConfig, {
      include: BackendModules,
    }),
    swaggerOptions,
  );

  // Allow the panel / websites on other origins to load /uploads images
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  await app.listen(port);

  console.log(`🚀 App running on port ${port}`);
  console.log(
    `📘 Backend Swagger URL: http://localhost:${port}/swagger/backend`,
  );
}

void bootstrap();
