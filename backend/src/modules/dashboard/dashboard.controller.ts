import { Controller, Get } from '@nestjs/common';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions('dashboard.view')
  @Get('summary')
  summary(@CurrentSession() session: SessionContext) {
    return this.dashboardService.getSummary(session);
  }
}
