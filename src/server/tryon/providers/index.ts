import { TryOnProvider } from './types';
import { StubProvider } from './stub';
import { FashnProvider } from './fashn';

export function getTryOnProvider(): TryOnProvider {
  const providerName = process.env.TRYON_PROVIDER || 'stub';

  switch (providerName) {
    case 'stub':
      return new StubProvider();
    case 'fashn':
      return new FashnProvider();
    default:
      console.warn(`Unknown provider "${providerName}", falling back to stub`);
      return new StubProvider();
  }
}

export type { TryOnProvider } from './types';
export { StubProvider } from './stub';
export { FashnProvider } from './fashn';

