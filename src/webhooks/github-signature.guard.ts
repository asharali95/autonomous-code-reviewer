import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { AppEnv } from '../config/env';
import { verifyGitHubSignature } from './github-signature';

@Injectable()
export class GitHubSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const rawBody = request.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    const valid = verifyGitHubSignature(
      this.config.get('GITHUB_WEBHOOK_SECRET', { infer: true }),
      rawBody,
      request.headers['x-hub-signature-256'] as string | undefined,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }
    return true;
  }
}
