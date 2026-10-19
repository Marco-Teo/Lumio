import type { NextConfig } from 'next';
import { parseEnvironment } from './src/server/env';

parseEnvironment(process.env);

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
