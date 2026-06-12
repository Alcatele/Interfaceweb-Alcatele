import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { SessionGuard } from './modules/auth/session.guard';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DatabaseModule } from './modules/database/database.module';
import { FusionPbxModule } from './modules/fusionpbx/fusionpbx.module';
import { HealthModule } from './modules/health/health.module';
import { PbxModule } from './modules/pbx/pbx.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { WebphoneModule } from './modules/webphone/webphone.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    UsersModule,
    DashboardModule,
    FusionPbxModule,
    PbxModule,
    WebphoneModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
  ],
})
export class AppModule {}
