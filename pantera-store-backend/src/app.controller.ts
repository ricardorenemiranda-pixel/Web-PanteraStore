import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  check() {
    return { status: 'ok', service: 'pantera-store-backend', timestamp: new Date().toISOString() };
  }
}
