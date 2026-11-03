import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  @Get()
  @Redirect('/swagger/backend', 302)
  root() {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
