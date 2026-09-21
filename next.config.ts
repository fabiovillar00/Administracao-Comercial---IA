import type { NextConfig } from 'next';

const nextConfig: NextConfig = process.env.PULSO_DEPLOY_TARGET === 'node'
  ? { output: 'standalone' }
  : {};

export default nextConfig;
