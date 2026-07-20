import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { USERS_MANAGERS, AuthUser } from '../../common/constants/roles';
import { UserService, CreateUserInput, UpdateUserInput } from './user.service';

/**
 * Ports legacy/controllers/userController.js — mounted at
 * /api/usuarios/manage (same router as AuthController in legacy authRoutes.js).
 */
@Controller('api/usuarios/manage')
@UseGuards(AuthGuard, RolesGuard)
@Roles(...USERS_MANAGERS)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const users = await this.userService.list(user);
    return { users };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateUserInput) {
    return this.userService.create(user, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateUserInput,
  ) {
    return this.userService.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.userService.remove(user, id);
  }
}
