export const PS_STORE_PRODUCT_BASE = 'https://store.playstation.com/product/';

export function storeProductUrl(storeProductId: string | null | undefined): string | null {
  return storeProductId ? PS_STORE_PRODUCT_BASE + encodeURIComponent(storeProductId) : null;
}
