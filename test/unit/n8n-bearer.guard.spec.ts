import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nBearerGuard } from '../../src/common/guards/n8n-bearer.guard';

describe('N8nBearerGuard', () => {
  const guard = new N8nBearerGuard({
    get: () => 'test-n8n-token',
  } as unknown as ConfigService);

  function context(authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    } as ExecutionContext;
  }

  it('accepts the configured bearer token', () => {
    expect(guard.canActivate(context('Bearer test-n8n-token'))).toBe(true);
  });

  it('rejects a missing or incorrect token', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('Bearer other'))).toThrow(
      UnauthorizedException,
    );
  });
});
