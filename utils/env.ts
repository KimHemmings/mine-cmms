function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

// NEXT_PUBLIC_* values are inlined at build time, so each must be referenced literally.
export const publicEnv = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ),
};

export function getAzureOpenAiEnv() {
  return {
    apiKey: required('AZURE_OPENAI_API_KEY', process.env.AZURE_OPENAI_API_KEY),
    endpoint: required('AZURE_OPENAI_ENDPOINT', process.env.AZURE_OPENAI_ENDPOINT).replace(/\/$/, ''),
    deploymentName: required('AZURE_OPENAI_DEPLOYMENT_NAME', process.env.AZURE_OPENAI_DEPLOYMENT_NAME),
    apiVersion: required('AZURE_OPENAI_API_VERSION', process.env.AZURE_OPENAI_API_VERSION),
  };
}
