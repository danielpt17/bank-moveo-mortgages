import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Resolves the acting customer.
 *
 * The assignment has no real authentication, so the DemoCustomerMiddleware
 * stamps the single demo customer on every request. Swapping this for a JWT
 * guard later changes nothing in the controllers or services.
 */
export const CurrentCustomer = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<Request & { customerId: string }>();
  return req.customerId;
});
