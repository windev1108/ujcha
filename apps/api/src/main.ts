import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger, swaggerDocsPath } from './swagger';

function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const allowedOrigins = parseCorsOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // No origin: React Native, mobile apps, curl, server-to-server
      if (!origin) return callback(null, true);
      // Electron production builds send "null" as origin string (file:// scheme)
      if (origin === 'null') return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }
  const port = process.env.PORT ?? 5000;
  await app.listen(port);
  console.log(`Swagger UI: http://localhost:${port}${swaggerDocsPath}`);
}
bootstrap();
