import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import type { AppEnv } from '../../config/env';

@Injectable()
export class N8nBearerGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const expected = `Bearer ${this.config.get('N8N_API_TOKEN', { infer: true })}`;
    if (!safeEqual(header, expected)) {
      throw new UnauthorizedException('Invalid orchestration token');
    }
    return true;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}
