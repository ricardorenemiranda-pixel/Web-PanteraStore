import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../../config/configuration';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import { ACTIVITY_FEED, type ActivityFeed } from '../../../../shared/activity/domain/activity-feed.port';
import { ActivityFeedItemDto, ActivityFeedQueryDto } from './dto/community.dto';

@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(
    @Inject(ACTIVITY_FEED) private readonly feed: ActivityFeed,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** Premios, bonos y sanciones recientes — de solo lectura, nadie escribe acá directamente. */
  @Get('feed')
  async activityFeed(@Query() query: ActivityFeedQueryDto) {
    const items = await this.feed.list(query.limit);
    return items.map(ActivityFeedItemDto.fromDomain);
  }

  /** Datos públicos de la comunidad (por ahora, solo el enlace de Discord si hay uno configurado). */
  @Get('config')
  communityConfig() {
    const { discordInviteUrl } = this.config.get('community', { infer: true });
    return { discordInviteUrl: discordInviteUrl || null };
  }
}
