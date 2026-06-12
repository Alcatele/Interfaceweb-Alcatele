import { Controller, Get, Header } from '@nestjs/common';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { WebphoneService } from './webphone.service';

@Controller('webphone')
export class WebphoneController {
  constructor(private readonly webphoneService: WebphoneService) {}

  @RequirePermissions('webphone.use')
  @Header('Cache-Control', 'no-store')
  @Get('config')
  config(@CurrentSession() session: SessionContext) {
    return this.webphoneService.getConfig(session);
  }
}
