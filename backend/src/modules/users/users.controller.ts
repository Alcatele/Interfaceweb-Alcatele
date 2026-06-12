import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { CurrentSession, RequirePermissions } from '../auth/auth.decorators';
import { SessionContext } from '../auth/auth.types';
import { UsersService } from './users.service';

class CreateUserBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @Matches(/^[a-z0-9._-]{3,80}$/)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['admin', 'user'])
  role!: string;

  @IsOptional()
  @Matches(/^[0-9A-Za-z*#_.-]{1,32}$/)
  extension?: string;
}

class ResetPasswordBody {
  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('users.manage')
  @Get('users')
  list(@CurrentSession() session: SessionContext) {
    return this.usersService.list(session);
  }

  @RequirePermissions('users.manage')
  @Post('users')
  create(
    @CurrentSession() session: SessionContext,
    @Body() body: CreateUserBody,
  ) {
    return this.usersService.create(session, body);
  }

  @RequirePermissions('users.manage')
  @Post('users/:userId/reset-password')
  resetPassword(
    @CurrentSession() session: SessionContext,
    @Param('userId') userId: string,
    @Body() body: ResetPasswordBody,
  ) {
    return this.usersService.resetPassword(session, userId, body.password);
  }

  @RequirePermissions('users.manage')
  @Delete('users/:userId')
  remove(
    @CurrentSession() session: SessionContext,
    @Param('userId') userId: string,
  ) {
    return this.usersService.remove(session, userId);
  }

  @RequirePermissions('permissions.view')
  @Get('permissions')
  permissions(@CurrentSession() session: SessionContext) {
    return this.usersService.permissions(session);
  }
}
