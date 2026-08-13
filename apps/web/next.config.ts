import type { NextConfig } from 'next';

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000';
const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  agentRules: false,
  transpilePackages: ['@so-yummy/api-client', '@so-yummy/contracts'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.themealdb.com', pathname: '/images/**' },
      { protocol: 'https', hostname: 'ftp.goit.study', pathname: '/img/**' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com', pathname: '/**' },
    ],
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};
export default nextConfig;
