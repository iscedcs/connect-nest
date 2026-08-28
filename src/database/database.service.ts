import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL!,
      max: 20,
      idleTimeoutMillis: 30_000,       // release idle connections after 30s
      connectionTimeoutMillis: 10_000, // fail fast if we can't get a connection in 10s
      keepAlive: true,                 // send TCP keep-alive to prevent firewall dropping idle sockets
      keepAliveInitialDelayMillis: 10_000,
    });

    // Prevent unhandled 'error' events on idle pool clients from crashing the process
    pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle database client', err);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
