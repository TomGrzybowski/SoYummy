import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { put } from '@vercel/blob';
import {
  createRecipeSchema,
  confirmPasswordChangeSchema,
  forgotPasswordSchema,
  loginSchema,
  paginationQuerySchema,
  registerSchema,
  requestPasswordChangeSchema,
  resendRegistrationSchema,
  resetPasswordSchema,
  searchQuerySchema,
  subscriptionSchema,
  updateProfileSchema,
  verifyRegistrationSchema,
  type Paginated,
  type Recipe,
  type User,
} from '@so-yummy/contracts';
import { Store, StoreError } from './store.js';
import { DatabaseStore } from './database-store.js';
import { AuthService, type AuthRepository } from './auth-service.js';
import { createMailer, type Mailer } from './mailer.js';

const cookieName = process.env.SESSION_COOKIE_NAME ?? 'so_yummy_session';
const paginate = <T>(items: T[], page: number, pageSize: number): Paginated<T> => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  page,
  pageSize,
  total: items.length,
  pageCount: Math.ceil(items.length / pageSize),
});

type AppStore = Store | DatabaseStore;

function createStore(): AppStore {
  if (process.env.DATABASE_URL) return new DatabaseStore();
  if (process.env.NODE_ENV === 'production')
    throw new Error('DATABASE_URL is required in production');
  return new Store();
}

export async function buildApp(store: AppStore = createStore(), mailer: Mailer = createMailer()) {
  if (store instanceof DatabaseStore && process.env.NODE_ENV === 'production')
    await store.ensureDemoAccount();
  const pepper =
    process.env.AUTH_CODE_PEPPER ??
    (process.env.NODE_ENV === 'production' ? undefined : 'development-only-auth-code-pepper');
  if (!pepper) throw new Error('AUTH_CODE_PEPPER is required in production');
  const auth = new AuthService(store as AuthRepository, mailer, pepper);
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: [
        'req.headers.authorization',
        `req.cookies.${cookieName}`,
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.code',
      ],
    },
    bodyLimit: 6 * 1024 * 1024,
  });
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  await app.register(swagger, {
    openapi: {
      info: { title: 'SoYummy API', version: '1.0.0', description: 'Portfolio-grade recipe API' },
      servers: [{ url: '/v1' }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof StoreError;
    const validation = typeof error === 'object' && error !== null && 'issues' in error;
    const message = error instanceof Error ? error.message : 'Invalid request.';
    reply.status(known ? error.statusCode : validation ? 400 : 500).send({
      code: known ? error.code : validation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
      message: known || validation ? message : 'Something went wrong.',
      requestId: request.id,
    });
  });
  const requireUser = async (request: FastifyRequest): Promise<User> => {
    const user = await store.userForToken(request.cookies[cookieName]);
    if (!user) throw new StoreError('UNAUTHORIZED', 'Authentication is required.', 401);
    return user;
  };
  const sessionCookie = {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 30 * 86_400,
  };

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => ({
    status: 'ready',
    catalog: {
      categories: store.catalog.categories.length,
      ingredients: store.catalog.ingredients.length,
      recipes: store.catalog.recipes.length,
    },
  }));
  app.post('/v1/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    await auth.requestRegistration(input, request.ip);
    reply.status(202);
    return { email: input.email, codeExpiresInSeconds: 600 };
  });
  app.post('/v1/auth/register/verify', async (request, reply) => {
    const input = verifyRegistrationSchema.parse(request.body);
    const result = await auth.verifyRegistration(input.email, input.code);
    reply.setCookie(cookieName, result.token, sessionCookie).status(201);
    return { user: result.user };
  });
  app.post('/v1/auth/register/resend', async (request, reply) => {
    const input = resendRegistrationSchema.parse(request.body);
    await auth.resendRegistration(input.email, request.ip);
    reply.status(202);
    return { email: input.email, codeExpiresInSeconds: 600 };
  });
  app.post('/v1/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await store.login(input.email, input.password);
    reply.setCookie(cookieName, result.token, sessionCookie);
    return { user: result.user };
  });
  app.post('/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[cookieName];
    if (token) await store.logout(token);
    reply.clearCookie(cookieName, { path: '/' }).status(204).send();
  });
  app.post('/v1/auth/password/forgot', async (request, reply) => {
    const { email } = forgotPasswordSchema.parse(request.body);
    await auth.requestPasswordReset(email, request.ip);
    reply.status(202);
    return { accepted: true };
  });
  app.post('/v1/auth/password/reset', async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    await auth.resetPassword(input.email, input.code, input.newPassword);
    reply.status(204).send();
  });
  app.post('/v1/auth/password/change/request', async (request, reply) => {
    const user = await requireUser(request);
    const input = requestPasswordChangeSchema.parse(request.body);
    await auth.requestPasswordChange(user.id, input.currentPassword, request.ip);
    reply.status(202).send({ accepted: true });
  });
  app.post('/v1/auth/password/change/confirm', async (request, reply) => {
    const user = await requireUser(request);
    const input = confirmPasswordChangeSchema.parse(request.body);
    const result = await auth.confirmPasswordChange(
      user.id,
      input.currentPassword,
      input.newPassword,
      input.code,
    );
    reply.setCookie(cookieName, result.token, sessionCookie).status(204).send();
  });
  app.get('/v1/users/me', async (request) => ({ user: await requireUser(request) }));
  app.patch('/v1/users/me', async (request) => {
    const user = await requireUser(request);
    return { user: await store.updateUser(user.id, updateProfileSchema.parse(request.body)) };
  });
  app.post('/v1/users/me/avatar', async (request) => {
    const user = await requireUser(request);
    const file = await request.file();
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      throw new StoreError('INVALID_IMAGE', 'Upload a JPEG, PNG or WebP image.', 400);
    const buffer = await file.toBuffer();
    const imageUrl = process.env.BLOB_READ_WRITE_TOKEN
      ? (
          await put(`avatars/${user.id}-${Date.now()}`, buffer, {
            access: 'public',
            contentType: file.mimetype,
          })
        ).url
      : `data:${file.mimetype};base64,${buffer.toString('base64')}`;
    return { user: await store.updateUser(user.id, { avatarUrl: imageUrl }) };
  });

  app.get('/v1/categories', async () => ({ items: store.catalog.categories }));
  app.get('/v1/ingredients', async () => ({ items: store.catalog.ingredients }));
  app.get('/v1/main-page', async () => {
    const recipes = await store.recipes();
    return {
      sections: ['Breakfast', 'Miscellaneous', 'Chicken', 'Dessert'].map((title) => ({
        title,
        items: recipes.filter((recipe) => recipe.category === title).slice(0, 4),
      })),
    };
  });
  app.get('/v1/recipes/popular', async () => ({ items: (await store.recipes()).slice(0, 4) }));
  app.get<{ Params: { id: string } }>('/v1/recipes/:id', async (request) => {
    const recipe = await store.recipe(request.params.id);
    if (!recipe) throw new StoreError('NOT_FOUND', 'Recipe not found.', 404);
    return { recipe };
  });
  app.get<{ Params: { category: string }; Querystring: Record<string, string> }>(
    '/v1/categories/:category/recipes',
    async (request) => {
      const { page, pageSize } = paginationQuerySchema.parse(request.query);
      return paginate(
        (await store.recipes()).filter(
          (recipe) =>
            recipe.category.toLowerCase() ===
            decodeURIComponent(request.params.category).toLowerCase(),
        ),
        page,
        pageSize,
      );
    },
  );
  app.get<{ Querystring: Record<string, string> }>('/v1/search', async (request) => {
    const { page, pageSize, query, ingredient } = searchQuerySchema.parse(request.query);
    const needle = query?.toLowerCase();
    const items = (await store.recipes()).filter(
      (recipe) =>
        (!needle || recipe.title.toLowerCase().includes(needle)) &&
        (!ingredient || recipe.ingredients.some((item) => item.ingredientId === ingredient)),
    );
    return paginate(items, page, pageSize);
  });
  app.post('/v1/recipes', async (request, reply) => {
    const user = await requireUser(request);
    const body = createRecipeSchema.parse(request.body);
    reply.status(201);
    return { recipe: await store.addRecipe(user.id, body, '/images/recipe-placeholder.svg') };
  });
  app.get('/v1/users/me/recipes', async (request) => {
    const user = await requireUser(request);
    return { items: (await store.recipes()).filter((recipe) => recipe.ownerId === user.id) };
  });
  app.delete<{ Params: { id: string } }>('/v1/recipes/:id', async (request, reply) => {
    const user = await requireUser(request);
    await store.deleteRecipe(user.id, request.params.id);
    reply.status(204).send();
  });

  app.get('/v1/favorites', async (request) => {
    const user = await requireUser(request);
    const ids = await store.favoriteIds(user.id);
    return { items: (await store.recipes()).filter((recipe) => ids.has(recipe.id)) };
  });
  app.post<{ Params: { id: string } }>('/v1/favorites/:id', async (request, reply) => {
    const user = await requireUser(request);
    await store.addFavorite(user.id, request.params.id);
    reply.status(204).send();
  });
  app.delete<{ Params: { id: string } }>('/v1/favorites/:id', async (request, reply) => {
    const user = await requireUser(request);
    await store.removeFavorite(user.id, request.params.id);
    reply.status(204).send();
  });
  app.get('/v1/shopping-list', async (request) => {
    const user = await requireUser(request);
    return { items: await store.shoppingItems(user.id) };
  });
  app.post('/v1/shopping-list', async (request, reply) => {
    const input = request.body as { ingredientId?: string; measure?: string };
    if (!input.ingredientId || !input.measure)
      throw new StoreError('VALIDATION_ERROR', 'ingredientId and measure are required.', 400);
    reply.status(201);
    const user = await requireUser(request);
    return { item: await store.addShopping(user.id, input.ingredientId, input.measure) };
  });
  app.delete<{ Params: { ingredientId: string } }>(
    '/v1/shopping-list/:ingredientId',
    async (request, reply) => {
      const user = await requireUser(request);
      await store.removeShopping(user.id, request.params.ingredientId);
      reply.status(204).send();
    },
  );
  app.get('/v1/achievements/unseen', async (request) => {
    const user = await requireUser(request);
    return { items: await store.unseenAchievements(user.id) };
  });
  app.post<{ Params: { code: Parameters<Store['markSeen']>[1] } }>(
    '/v1/achievements/:code/seen',
    async (request, reply) => {
      const user = await requireUser(request);
      await store.markSeen(user.id, request.params.code);
      reply.status(204).send();
    },
  );
  app.post('/v1/subscribe', async (request, reply) => {
    const { email } = subscriptionSchema.parse(request.body);
    const created = await store.subscribe(email);
    reply.status(created ? 201 : 200);
    return { subscribed: true, created };
  });
  return app;
}
