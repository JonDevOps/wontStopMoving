export function isPendingProvider(status?: string): boolean {
  return !status || status === 'pending' || status === 'pending_approval';
}

export function providerCreatedMillis(provider: { createdAt?: { toMillis?: () => number } | null }): number {
  return provider.createdAt?.toMillis?.() || 0;
}
