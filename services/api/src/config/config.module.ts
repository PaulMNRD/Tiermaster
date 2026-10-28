import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig, loadConfig } from './app-config.js';

@Global()
@Module({})
export class ConfigModule {
  /** Uses the given config (tests) or reads it from the environment. */
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config ?? loadConfig() }],
      exports: [APP_CONFIG],
    };
  }
}
