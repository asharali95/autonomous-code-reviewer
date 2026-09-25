import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  type AiReviewFinding,
  fingerprintFinding,
  toPrismaSeverity,
} from './ai-reviewer.interface';

@Injectable()
export class FindingsService {
  constructor(private readonly prisma: PrismaService) {}

  async replaceCycleFindings(
    reviewCycleId: string,
    findings: AiReviewFinding[],
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await tx.findingEvent.deleteMany({
        where: { finding: { reviewCycleId } },
      });
      await tx.finding.deleteMany({ where: { reviewCycleId } });

      let created = 0;
      for (const finding of findings) {
        const fingerprint = fingerprintFinding(finding);
        const row = await tx.finding.create({
          data: {
            reviewCycleId,
            fingerprint,
            severity: toPrismaSeverity(finding.severity),
            path: finding.path,
            line: finding.line,
            message: finding.message.slice(0, 2000),
          },
        });
        await tx.findingEvent.create({
          data: {
            findingId: row.id,
            eventType: 'finding.created',
            payload: {
              path: finding.path,
              line: finding.line,
              severity: finding.severity,
            } as Prisma.InputJsonValue,
          },
        });
        created += 1;
      }
      return created;
    });
  }

  countForCycle(reviewCycleId: string): Promise<number> {
    return this.prisma.finding.count({ where: { reviewCycleId } });
  }
}
