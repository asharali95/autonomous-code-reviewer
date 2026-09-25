import { Module } from '@nestjs/common';
import { RepositoryRegistryService } from './repository-registry.service';

@Module({
  providers: [RepositoryRegistryService],
  exports: [RepositoryRegistryService],
})
export class RepositoriesModule {}
