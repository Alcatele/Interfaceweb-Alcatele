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
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { TenantLimits } from '../database/resource-limits.service';
import { TenantsService } from './tenants.service';

class TenantLimitsBody implements TenantLimits {
  @IsInt()
  @Min(1)
  @Max(100000)
  users!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  extensions!: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  trunks!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  inboundRoutes!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  outboundRoutes!: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  pickupGroups!: number;

  @IsInt()
  @Min(0)
  @Max(10000)
  ringGroups!: number;

  @IsInt()
  @Min(0)
  @Max(100000)
  voicemailBoxes!: number;
}

class CreateTenantBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @Matches(/^[a-z0-9][a-z0-9-]{1,62}$/)
  slug!: string;

  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/)
  domain!: string;

  @ValidateNested()
  @Type(() => TenantLimitsBody)
  limits!: TenantLimitsBody;
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

  @Get('current/resources')
  resources(@CurrentSession() session: SessionContext) {
    return this.tenantsService.resources(session);
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
  @Patch(':tenantId/limits')
  updateLimits(
    @CurrentSession() session: SessionContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: TenantLimitsBody,
  ) {
    return this.tenantsService.updateLimits(session, tenantId, body);
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
