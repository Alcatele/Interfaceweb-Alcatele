import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { ResourceLimitsService } from './resource-limits.service';

@Global()
@Module({
  providers: [DatabaseService, ResourceLimitsService],
  exports: [DatabaseService, ResourceLimitsService],
})
export class DatabaseModule {}
