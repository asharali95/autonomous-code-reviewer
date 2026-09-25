import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Autonomous PR Reviewer API')
    .setDescription(
      [
        'Backend for GitHub PR webhook intake, review-cycle state, and incremental diff manifests.',
        '',
        '**Orchestration** routes require `Authorization: Bearer <N8N_API_TOKEN>`.',
        '**Webhooks** require a valid GitHub `X-Hub-Signature-256` over the raw body.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local development')
    .addServer(
      'https://code-reviewer-api.codefied.online',
      'Production (codefied)',
    )
    .addServer(
      'https://f04f-182-180-189-17.ngrok-free.app',
      'ngrok tunnel (dev)',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        description: 'Value of N8N_API_TOKEN from the server environment',
      },
      'n8n-bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Hub-Signature-256',
        description: 'sha256=<hmac> of the raw request body using GITHUB_WEBHOOK_SECRET',
      },
      'github-signature',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-GitHub-Event',
        description: 'GitHub event name, e.g. pull_request',
      },
      'github-event',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-GitHub-Delivery',
        description: 'Unique delivery UUID from GitHub',
      },
      'github-delivery',
    )
    .addTag('health', 'Liveness / readiness')
    .addTag('webhooks', 'GitHub webhook intake')
    .addTag('orchestration', 'n8n review-cycle API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'PR Reviewer API Docs',
  });
}
