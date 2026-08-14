import 'fastify';
import { buildApp } from './build-app.js';

const app = await buildApp();

void app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
