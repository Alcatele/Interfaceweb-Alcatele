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
import { IsIn, IsString, Matches, MinLength } from 'class-validator';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { TenantsService } from './tenants.service';

class CreateTenantBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/)
  slug!: string;

  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/)
  domain!: string;
}

class TenantStatusBody {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  list(@CurrentSession() session: SessionContext) {
    return this.tenantsService.list(session);
  }

  @RequirePermissions('tenant.manage')
  @Post()
  create(
    @CurrentSession() session: SessionContext,
    @Body() body: CreateTenantBody,
  ) {
    return this.tenantsService.create(session, body);
  }

  @RequirePermissions('tenant.manage')
  @Patch(':tenantId/status')
  setStatus(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: TenantStatusBody,
  ) {
    return this.tenantsService.setStatus(tenantId, body.status);
  }

  @RequirePermissions('tenant.manage')
  @Delete(':tenantId')
  close(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.tenantsService.close(tenantId);
  }
}
