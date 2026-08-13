import { buildApp } from './app';

const app = await buildApp();
if (!process.env.VERCEL)
  await app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' });
export default app;
