import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { Env } from '../config/env';

@Injectable()
export class DemoCustomerMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService<Env, true>) {}

  use(req: Request & { customerId?: string }, _res: Response, next: NextFunction): void {
    req.customerId = this.config.get('DEMO_CUSTOMER_ID', { infer: true });
    next();
  }
}
