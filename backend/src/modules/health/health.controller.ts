import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.decorators';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return {
      service: 'alcatele-mvp-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
