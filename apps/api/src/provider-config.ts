import { createOpenAIExplanationProvider } from './openai-provider.js';
import {
  deterministicExplanationProvider,
  type ExplanationProvider,
} from './provider.js';

type ProviderEnvironment = Partial<
  Record<'EXPLANATION_PROVIDER' | 'OPENAI_API_KEY' | 'OPENAI_MODEL', string | undefined>
>;

export function createConfiguredExplanationProvider(
  environment: ProviderEnvironment = process.env,
): ExplanationProvider {
  const provider = environment.EXPLANATION_PROVIDER?.trim() || 'deterministic';

  if (provider === 'deterministic') {
    return deterministicExplanationProvider;
  }

  if (provider === 'openai') {
    return createOpenAIExplanationProvider({
      apiKey: environment.OPENAI_API_KEY ?? '',
      model: environment.OPENAI_MODEL ?? '',
    });
  }

  throw new Error(`Unsupported EXPLANATION_PROVIDER: ${provider}`);
}
