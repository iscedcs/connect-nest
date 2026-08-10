import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { PushService } from '../src/push/push.service';
import * as jwt from 'jsonwebtoken';
import { jwtSecret } from '../utils/constants';

export const setupE2eApp = async (mockUserId: string = 'test-creator-id') => {
  jest.setTimeout(60000); // increase timeout for e2e tests
  // Generate a valid JWT token
  const token = jwt.sign({ id: mockUserId, email: 'test@example.com' }, jwtSecret);

  const mockPushService = {
    onModuleInit: () => {},
    sendPushNotification: async () => {},
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PushService)
    .useValue(mockPushService)
    .compile();

  const app: INestApplication = moduleFixture.createNestApplication({ rawBody: true });
  
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();
  
  const db = app.get<DatabaseService>(DatabaseService);

  return { app, db, moduleFixture, token };
};

