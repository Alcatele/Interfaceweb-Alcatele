import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { PbxService } from './pbx.service';

class ExtensionBody {
  @Matches(/^[0-9A-Za-z*#_.-]{1,32}$/)
  number!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  department!: string;

  @IsString()
  device!: string;

  @IsOptional()
  @IsIn(['online', 'offline', 'warning'])
  status?: string;
}

class TrunkBody {
  @IsString()
  name!: string;

  @IsString()
  provider!: string;

  @IsString()
  host!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  channels!: number;

  @IsOptional()
  @IsIn(['registered', 'failed', 'warning'])
  status?: string;
}

class InboundRouteBody {
  @IsString()
  did!: string;

  @IsString()
  description!: string;

  @IsString()
  destination!: string;

  @IsString()
  schedule!: string;

  @IsBoolean()
  enabled!: boolean;
}

class OutboundRouteBody {
  @IsString()
  name!: string;

  @IsString()
  pattern!: string;

  @IsUUID()
  trunkId!: string;

  @IsInt()
  @Min(0)
  priority!: number;

  @IsBoolean()
  enabled!: boolean;
}

@RequirePermissions('pbx.view')
@Controller('pbx')
export class PbxController {
  constructor(private readonly pbxService: PbxService) {}

  @Get('extensions')
  extensions(@CurrentSession() session: SessionContext) {
    return this.pbxService.listExtensions(session);
  }

  @RequirePermissions('pbx.configure')
  @Post('extensions')
  createExtension(
    @CurrentSession() session: SessionContext,
    @Body() body: ExtensionBody,
  ) {
    return this.pbxService.createExtension(session, body);
  }

  @RequirePermissions('pbx.configure')
  @Patch('extensions/:id')
  updateExtension(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ExtensionBody,
  ) {
    return this.pbxService.updateExtension(session, id, body);
  }

  @RequirePermissions('pbx.configure')
  @Delete('extensions/:id')
  removeExtension(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pbxService.removeExtension(session, id);
  }

  @Get('trunks')
  trunks(@CurrentSession() session: SessionContext) {
    return this.pbxService.listTrunks(session);
  }

  @RequirePermissions('pbx.configure')
  @Post('trunks')
  createTrunk(
    @CurrentSession() session: SessionContext,
    @Body() body: TrunkBody,
  ) {
    return this.pbxService.createTrunk(session, body);
  }

  @RequirePermissions('pbx.configure')
  @Patch('trunks/:id')
  updateTrunk(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TrunkBody,
  ) {
    return this.pbxService.updateTrunk(session, id, body);
  }

  @RequirePermissions('pbx.configure')
  @Delete('trunks/:id')
  removeTrunk(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pbxService.removeTrunk(session, id);
  }

  @Get('routes/inbound')
  inboundRoutes(@CurrentSession() session: SessionContext) {
    return this.pbxService.listInboundRoutes(session);
  }

  @RequirePermissions('pbx.configure')
  @Post('routes/inbound')
  createInboundRoute(
    @CurrentSession() session: SessionContext,
    @Body() body: InboundRouteBody,
  ) {
    return this.pbxService.createInboundRoute(session, body);
  }

  @RequirePermissions('pbx.configure')
  @Patch('routes/inbound/:id')
  updateInboundRoute(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: InboundRouteBody,
  ) {
    return this.pbxService.updateInboundRoute(session, id, body);
  }

  @RequirePermissions('pbx.configure')
  @Delete('routes/inbound/:id')
  removeInboundRoute(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pbxService.removeInboundRoute(session, id);
  }

  @Get('routes/outbound')
  outboundRoutes(@CurrentSession() session: SessionContext) {
    return this.pbxService.listOutboundRoutes(session);
  }

  @RequirePermissions('pbx.configure')
  @Post('routes/outbound')
  createOutboundRoute(
    @CurrentSession() session: SessionContext,
    @Body() body: OutboundRouteBody,
  ) {
    return this.pbxService.createOutboundRoute(session, body);
  }

  @RequirePermissions('pbx.configure')
  @Patch('routes/outbound/:id')
  updateOutboundRoute(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: OutboundRouteBody,
  ) {
    return this.pbxService.updateOutboundRoute(session, id, body);
  }

  @RequirePermissions('pbx.configure')
  @Delete('routes/outbound/:id')
  removeOutboundRoute(
    @CurrentSession() session: SessionContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pbxService.removeOutboundRoute(session, id);
  }
}
