import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GitHubSignatureGuard } from './github-signature.guard';
import {
  type PullRequestWebhookBody,
  PullRequestWebhookHandler,
} from './pull-request-webhook.handler';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly handler: PullRequestWebhookHandler) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GitHubSignatureGuard)
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
