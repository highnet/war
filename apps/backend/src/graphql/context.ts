import type { FastifyRequest } from 'fastify';

export async function buildContext(request: FastifyRequest) {
  return {
    request,
  };
}
