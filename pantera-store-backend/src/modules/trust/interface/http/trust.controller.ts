import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../../auth/interface/decorators/current-user.decorator';
import { Roles } from '../../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/interface/guards/jwt-auth.guard';
import type { RequestUser } from '../../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/interface/guards/roles.guard';
import {
  CreateDisputeUseCase,
  GetDisputeEvidenceUseCase,
  ListDisputesUseCase,
  ResolveDisputeUseCase,
} from '../../application/use-cases/dispute-use-cases';
import {
  CreateReportUseCase,
  GetReportEvidenceUseCase,
  ListReportsUseCase,
  ReviewReportUseCase,
} from '../../application/use-cases/report-use-cases';
import {
  ApplySanctionUseCase,
  IsUserSuspendedUseCase,
  ListSanctionsUseCase,
  RevokeSanctionUseCase,
} from '../../application/use-cases/sanction-use-cases';
import { TRUST_REPOSITORY, type TrustRepository } from '../../domain/ports/trust.repository.port';
import {
  AuditQueryDto,
  ApplySanctionDto,
  CreateDisputeDto,
  CreateReportDto,
  DisputeResponseDto,
  ListQueryDto,
  ReportResponseDto,
  ResolveDisputeDto,
  ReviewReportDto,
  RevokeSanctionDto,
  SanctionResponseDto,
} from './dto/trust.dto';
import { Inject } from '@nestjs/common';
import { AUDIT_LOG, type AuditLog } from '../../../../shared/audit/domain/audit-log.port';

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrustController {
  constructor(
    private readonly createReport: CreateReportUseCase,
    private readonly listReports: ListReportsUseCase,
    private readonly reviewReport: ReviewReportUseCase,
    private readonly getReportEvidence: GetReportEvidenceUseCase,
    private readonly applySanction: ApplySanctionUseCase,
    private readonly revokeSanction: RevokeSanctionUseCase,
    private readonly listSanctions: ListSanctionsUseCase,
    private readonly isSuspended: IsUserSuspendedUseCase,
    private readonly createDispute: CreateDisputeUseCase,
    private readonly listDisputes: ListDisputesUseCase,
    private readonly resolveDispute: ResolveDisputeUseCase,
    private readonly getDisputeEvidence: GetDisputeEvidenceUseCase,
    @Inject(TRUST_REPOSITORY) private readonly trust: TrustRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  // ------------------------------------------------------------- reportes

  /** Cualquier usuario logueado puede reportar a otro, con evidencia opcional (imagen). */
  @Post('reports')
  @UseInterceptors(
    FileInterceptor('evidence', { storage: memoryStorage(), limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1 } }),
  )
  async report(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateReportDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const report = await this.createReport.execute(
      user.userId,
      dto,
      file ? { data: file.buffer } : undefined,
    );
    return ReportResponseDto.from(report);
  }

  @Get('admin/reports')
  @Roles('admin')
  async adminReports(@Query() query: ListQueryDto) {
    const reports = await this.listReports.listPendingAndAll(query.view ?? 'pending');
    return reports.map(ReportResponseDto.from);
  }

  @Get('admin/reports/:id/evidence')
  @Roles('admin')
  async reportEvidence(@Param('id') id: string, @Res() res: Response) {
    const evidence = await this.getReportEvidence.execute(id);
    res.set({
      'Content-Type': evidence.contentType,
      'Content-Length': String(evidence.data.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
    });
    res.end(evidence.data);
  }

  @Post('admin/reports/:id/resolve')
  @HttpCode(200)
  @Roles('admin')
  async resolveReport(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: ReviewReportDto) {
    const report = await this.reviewReport.resolve(admin.userId, id, dto.note ?? '', dto.sanctionId);
    return ReportResponseDto.from(report);
  }

  @Post('admin/reports/:id/dismiss')
  @HttpCode(200)
  @Roles('admin')
  async dismissReport(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: ReviewReportDto) {
    const report = await this.reviewReport.dismiss(admin.userId, id, dto.note ?? '');
    return ReportResponseDto.from(report);
  }

  // ------------------------------------------------------------ sanciones

  @Post('admin/sanctions')
  @HttpCode(201)
  @Roles('admin')
  async applySanctionEndpoint(@CurrentUser() admin: RequestUser, @Body() dto: ApplySanctionDto) {
    const sanction = await this.applySanction.execute(admin.userId, {
      ...dto,
      suspendedUntil: dto.suspendedUntil ? new Date(dto.suspendedUntil) : undefined,
    });
    return SanctionResponseDto.from(sanction);
  }

  @Post('admin/sanctions/:id/revoke')
  @HttpCode(200)
  @Roles('admin')
  async revokeSanctionEndpoint(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: RevokeSanctionDto) {
    const sanction = await this.revokeSanction.execute(admin.userId, id, dto.reason);
    return SanctionResponseDto.from(sanction);
  }

  @Get('admin/sanctions')
  @Roles('admin')
  async adminSanctions() {
    const sanctions = await this.listSanctions.listAll();
    return sanctions.map((s) => SanctionResponseDto.from(s));
  }

  /** Mis sanciones: lo que ve el propio jugador (incluida una suspensión activa, si tiene). */
  @Get('sanctions/me')
  async mySanctions(@CurrentUser() user: RequestUser) {
    const [sanctions, active] = await Promise.all([
      this.listSanctions.listOfUser(user.userId),
      this.isSuspended.execute(user.userId),
    ]);
    return {
      sanctions: sanctions.map((s) => SanctionResponseDto.from(s)),
      activeSuspension: active ? SanctionResponseDto.from(active) : null,
    };
  }

  // ------------------------------------------------------------- disputas

  /** El jugador impugna el resultado de SU partida, con evidencia opcional. */
  @Post('disputes')
  @UseInterceptors(
    FileInterceptor('evidence', { storage: memoryStorage(), limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1 } }),
  )
  async dispute(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDisputeDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const created = await this.createDispute.execute(
      user.userId,
      dto,
      file ? { data: file.buffer } : undefined,
    );
    return DisputeResponseDto.from(created);
  }

  @Get('admin/disputes')
  @Roles('admin')
  async adminDisputes(@Query() query: ListQueryDto) {
    const disputes = await this.listDisputes.listPendingAndAll(query.view ?? 'pending');
    return disputes.map(DisputeResponseDto.from);
  }

  @Get('admin/disputes/:id/evidence')
  @Roles('admin')
  async disputeEvidence(@Param('id') id: string, @Res() res: Response) {
    const evidence = await this.getDisputeEvidence.execute(id);
    res.set({
      'Content-Type': evidence.contentType,
      'Content-Length': String(evidence.data.length),
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
    });
    res.end(evidence.data);
  }

  @Post('admin/disputes/:id/uphold')
  @HttpCode(200)
  @Roles('admin')
  async uphold(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return DisputeResponseDto.from(await this.resolveDispute.uphold(admin.userId, id, dto.note ?? ''));
  }

  @Post('admin/disputes/:id/reject')
  @HttpCode(200)
  @Roles('admin')
  async rejectDispute(@CurrentUser() admin: RequestUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return DisputeResponseDto.from(await this.resolveDispute.reject(admin.userId, id, dto.note ?? ''));
  }

  // ----------------------------------------------------------- antifraude

  @Get('admin/fraud/duplicate-accounts')
  @Roles('admin')
  duplicateAccounts() {
    return this.trust.findDuplicateAccountGroups();
  }

  /** Pares de jugadores con partidas juntos y un ganador muy desbalanceado (posible "farming"). */
  @Get('admin/fraud/collusion')
  @Roles('admin')
  collusion() {
    return this.trust.findCollusionCandidates(5, 0.85);
  }

  // ---------------------------------------------------------------- audit

  @Get('admin/audit')
  @Roles('admin')
  auditLog(@Query() query: AuditQueryDto) {
    return this.audit.list({ actorId: query.actorId, action: query.action, limit: query.limit });
  }
}
