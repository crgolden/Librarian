import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

/**
 * In production (when KeyVaultUri is set), loads LibrarianClientId and
 * LibrarianClientSecret from Azure Key Vault and writes them into
 * process.env so the rest of the BFF can read them uniformly.
 *
 * In development the secrets are expected to already be present as
 * environment variables (App Service settings / local .env / launch profile).
 */
export async function loadKeyVaultSecrets(): Promise<void> {
  const keyVaultUri = process.env['KeyVaultUri'];
  if (!keyVaultUri) {
    // Development: secrets come directly from environment variables.
    return;
  }

  const credential = new DefaultAzureCredential();
  const client = new SecretClient(keyVaultUri, credential);

  const [clientIdSecret, clientSecretSecret] = await Promise.all([
    client.getSecret('LibrarianClientId'),
    client.getSecret('LibrarianClientSecret'),
  ]);

  if (clientIdSecret.value) {
    process.env['LibrarianClientId'] = clientIdSecret.value;
  }

  if (clientSecretSecret.value) {
    process.env['LibrarianClientSecret'] = clientSecretSecret.value;
  }
}
