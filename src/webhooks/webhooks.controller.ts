import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GitHubSignatureGuard } from './github-signature.guard';
import {
  type PullRequestWebhookBody,
  PullRequestWebhookHandler,
} from './pull-request-webhook.handler';
import { WebhookResultDto } from '../orchestration/dto/swagger-responses.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly handler: PullRequestWebhookHandler) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GitHubSignatureGuard)
  @ApiOperation({
    summary: 'GitHub webhook receiver',
    description:
      'Validates X-Hub-Signature-256 against the raw body. Handles pull_request opened/synchronize; other events are recorded as ignored. Prefer calling this from GitHub, not Swagger Try-it-out (signature must match the exact body bytes).',
  })
  @ApiSecurity('github-signature')
  @ApiSecurity('github-event')
  @ApiSecurity('github-delivery')
  @ApiHeader({
    name: 'X-GitHub-Event',
    required: true,
    example: 'pull_request',
  })
  @ApiHeader({
    name: 'X-GitHub-Delivery',
    required: true,
    example: '1c3241b0-b8f5-11f1-9151-b4fe9c936a71',
  })
  @ApiHeader({
    name: 'X-Hub-Signature-256',
    required: true,
    example: 'sha256=…',
  })
  @ApiOkResponse({ type: WebhookResultDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing signature' })
  handle(
    @Headers('x-github-event') eventType: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() body: PullRequestWebhookBody,
  ) {
    return this.handler.handle({
      deliveryId,
      eventType,
      body,
    });
  }
}
