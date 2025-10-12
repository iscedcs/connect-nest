import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      }
    })
  );

  app.enableCors({
    origin: ['http://localhost:3001', 'https://isceauth.onrender.com', 'http://localhost:3154', 'https://stingray-app-clk8t.ondigitalocean.app', 'https://connect-nest.onrender.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useLogger(process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose']);


  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('ISCE CONNECT API')
    .setDescription('The official Documentations of ISCE CONNECT API.')
    .setVersion('1.0')
    .addTag('ISCE CONNECT API')
    .addBearerAuth(
      { 
        type: 'http', 
        scheme: 'bearer', 
        bearerFormat: 'JWT' 
      }, 
      'access-token' // The name used to reference this auth method in the Swagger UI
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keeps the token across routes
    },
  });

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 App is running on port ${process.env.PORT}`);
}
bootstrap();
