import Fastify from 'fastify';
import mercurius from 'mercurius';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { schema } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { buildContext } from './graphql/context.js';
import { redisStore } from './store/RedisStore.js';
import { redisPubSub } from './websocket/RedisPubSub.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
    credentials: true,
  });

  app.register(mercurius, {
    schema,
    resolvers,
    context: buildContext,
    subscription: true,
    graphiql: true,
  });

  app.addHook('onClose', async () => {
    await redisStore.disconnect();
    await redisPubSub.disconnect();
  });

  return app;
}
