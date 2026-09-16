/**
 * Render runs seed on every deploy. Never rotate an existing admin passwordHash.
 * Do not print ADMIN_PASSWORD.
 */
export function resolveAdminSeedAction({ existingAdmin, nodeEnv, adminPassword }) {
  if (existingAdmin) {
    return { action: 'update-name-only' };
  }
  const password = typeof adminPassword === 'string' ? adminPassword : '';
  if (!password) {
    if (nodeEnv === 'production') {
      return {
        action: 'abort',
        error: 'ADMIN_PASSWORD must be set to create the admin account in production',
      };
    }
    return { action: 'create', useBuiltinDevPassword: true };
  }
  return { action: 'create', useBuiltinDevPassword: false };
}
