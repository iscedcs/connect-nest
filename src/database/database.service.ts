import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect(); // Ensure Prisma connects to the database
  }

  async onModuleDestroy() {
    await this.$disconnect(); // Disconnect when the module is destroyed
  }
} 
