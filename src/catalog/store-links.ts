export const PS_STORE_PRODUCT_BASE = 'https://store.playstation.com/product/';

/** The public PlayStation Store page for a product id, or null when the catalog knows no product. */
export function storeProductUrl(storeProductId: string | null | undefined): string | null {
  return storeProductId ? PS_STORE_PRODUCT_BASE + encodeURIComponent(storeProductId) : null;
}
