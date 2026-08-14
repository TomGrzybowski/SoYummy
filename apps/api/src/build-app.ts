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
  loginSchema,
  paginationQuerySchema,
  registerSchema,
  searchQuerySchema,
  subscriptionSchema,
  updateProfileSchema,
  type Paginated,
  type Recipe,
  type User,
} from '@so-yummy/contracts';
import { Store, StoreError } from './store.js';

const cookieName = process.env.SESSION_COOKIE_NAME ?? 'so_yummy_session';
const paginate = <T>(items: T[], page: number, pageSize: number): Paginated<T> => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  page,
  pageSize,
  total: items.length,
  pageCount: Math.ceil(items.length / pageSize),
});

export async function buildApp(store = new Store()) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', `req.cookies.${cookieName}`],
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
  const requireUser = (request: FastifyRequest): User => {
    const user = store.userForToken(request.cookies[cookieName]);
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
    const result = await store.register(input.name, input.email, input.password);
    reply.setCookie(cookieName, result.token, sessionCookie).status(201);
    return { user: result.user };
  });
  app.post('/v1/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const result = await store.login(input.email, input.password);
    reply.setCookie(cookieName, result.token, sessionCookie);
    return { user: result.user };
  });
  app.post('/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[cookieName];
    if (token) store.logout(token);
    reply.clearCookie(cookieName, { path: '/' }).status(204).send();
  });
  app.get('/v1/users/me', async (request) => ({ user: requireUser(request) }));
  app.patch('/v1/users/me', async (request) => ({
    user: store.updateUser(requireUser(request).id, updateProfileSchema.parse(request.body)),
  }));
  app.post('/v1/users/me/avatar', async (request) => {
    const user = requireUser(request);
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
    return { user: store.updateUser(user.id, { avatarUrl: imageUrl }) };
  });

  app.get('/v1/categories', async () => ({ items: store.catalog.categories }));
  app.get('/v1/ingredients', async () => ({ items: store.catalog.ingredients }));
  app.get('/v1/main-page', async () => ({
    sections: ['Breakfast', 'Miscellaneous', 'Chicken', 'Dessert'].map((title) => ({
      title,
      items: store
        .recipes()
        .filter((recipe) => recipe.category === title)
        .slice(0, 4),
    })),
  }));
  app.get('/v1/recipes/popular', async () => ({ items: store.recipes().slice(0, 4) }));
  app.get<{ Params: { id: string } }>('/v1/recipes/:id', async (request) => {
    const recipe = store.recipe(request.params.id);
    if (!recipe) throw new StoreError('NOT_FOUND', 'Recipe not found.', 404);
    return { recipe };
  });
  app.get<{ Params: { category: string }; Querystring: Record<string, string> }>(
    '/v1/categories/:category/recipes',
    async (request) => {
      const { page, pageSize } = paginationQuerySchema.parse(request.query);
      return paginate(
        store
          .recipes()
          .filter(
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
    const items = store
      .recipes()
      .filter(
        (recipe) =>
          (!needle || recipe.title.toLowerCase().includes(needle)) &&
          (!ingredient || recipe.ingredients.some((item) => item.ingredientId === ingredient)),
      );
    return paginate(items, page, pageSize);
  });
  app.post('/v1/recipes', async (request, reply) => {
    const user = requireUser(request);
    const body = createRecipeSchema.parse(request.body);
    reply.status(201);
    return { recipe: store.addRecipe(user.id, body, '/images/recipe-placeholder.svg') };
  });
  app.get('/v1/users/me/recipes', async (request) => ({
    items: store.recipes().filter((recipe) => recipe.ownerId === requireUser(request).id),
  }));
  app.delete<{ Params: { id: string } }>('/v1/recipes/:id', async (request, reply) => {
    store.deleteRecipe(requireUser(request).id, request.params.id);
    reply.status(204).send();
  });

  app.get('/v1/favorites', async (request) => {
    const user = requireUser(request);
    const ids = store.favoriteIds(user.id);
    return { items: store.recipes().filter((recipe) => ids.has(recipe.id)) };
  });
  app.post<{ Params: { id: string } }>('/v1/favorites/:id', async (request, reply) => {
    store.addFavorite(requireUser(request).id, request.params.id);
    reply.status(204).send();
  });
  app.delete<{ Params: { id: string } }>('/v1/favorites/:id', async (request, reply) => {
    store.removeFavorite(requireUser(request).id, request.params.id);
    reply.status(204).send();
  });
  app.get('/v1/shopping-list', async (request) => ({
    items: store.shoppingItems(requireUser(request).id),
  }));
  app.post('/v1/shopping-list', async (request, reply) => {
    const input = request.body as { ingredientId?: string; measure?: string };
    if (!input.ingredientId || !input.measure)
      throw new StoreError('VALIDATION_ERROR', 'ingredientId and measure are required.', 400);
    reply.status(201);
    return { item: store.addShopping(requireUser(request).id, input.ingredientId, input.measure) };
  });
  app.delete<{ Params: { ingredientId: string } }>(
    '/v1/shopping-list/:ingredientId',
    async (request, reply) => {
      store.removeShopping(requireUser(request).id, request.params.ingredientId);
      reply.status(204).send();
    },
  );
  app.get('/v1/achievements/unseen', async (request) => ({
    items: store.unseenAchievements(requireUser(request).id),
  }));
  app.post<{ Params: { code: Parameters<Store['markSeen']>[1] } }>(
    '/v1/achievements/:code/seen',
    async (request, reply) => {
      store.markSeen(requireUser(request).id, request.params.code);
      reply.status(204).send();
    },
  );
  app.post('/v1/subscribe', async (request, reply) => {
    const { email } = subscriptionSchema.parse(request.body);
    const created = store.subscribe(email);
    reply.status(created ? 201 : 200);
    return { subscribed: true, created };
  });
  return app;
}
