import type { NextConfig } from 'next';
import { parseEnvironment } from './src/server/env';
import { authenticationEnvironment } from './src/server/auth/environment';

parseEnvironment(process.env);
if (process.env.NODE_ENV === 'production') authenticationEnvironment();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@lumio/database'],
  logging: {
    incomingRequests: false,
    serverFunctions: false,
    browserToTerminal: false,
  },
};

export default nextConfig;
