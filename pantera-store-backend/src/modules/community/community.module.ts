import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommunityController } from './interface/http/community.controller';

@Module({
  imports: [AuthModule],
  controllers: [CommunityController],
})
export class CommunityModule {}
