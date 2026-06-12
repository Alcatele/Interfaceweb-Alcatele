import { Controller, Get, Post } from '@nestjs/common';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { FusionPbxService } from './fusionpbx.service';

@RequirePermissions('pbx.view')
@Controller('fusionpbx')
export class FusionPbxController {
  constructor(private readonly fusionPbxService: FusionPbxService) {}

  @Get('status')
  status(@CurrentSession() session: SessionContext) {
    return this.fusionPbxService.status(session);
  }

  @RequirePermissions('pbx.configure')
  @Post('sync')
  sync(@CurrentSession() session: SessionContext) {
    return this.fusionPbxService.sync(session);
  }
}
