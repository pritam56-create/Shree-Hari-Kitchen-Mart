export const contentRule = 'Before inserting a product, banner, demo image, recipe, description or promotion into the database, verify that it contains no non-vegetarian food, egg-related content or dedicated non-vegetarian appliance.';
export class ContentPolicyError extends Error {}
export const adminNotice = 'Only vegetarian kitchen appliances and vegetarian-oriented product content are allowed on this website. Do not upload egg, meat, fish, chicken, seafood or other non-vegetarian content.';
const forbidden = /\b(eggs?|egg[- ]based|chicken|meat|mincer|fish|seafood|mutton|lamb|pork|beef|turkey|bacon|ham|sausages?|poultry|tenderizers?|smokers?|non[- ]?vegetarian)\b/i;
export function validateContent(value: unknown, confirmed: boolean, imageReviewed = true) {
  if (!confirmed) throw new ContentPolicyError('Vegetarian compliance confirmation is required.');
  const scan = (v: unknown): boolean => typeof v === 'string' ? forbidden.test(v.normalize('NFKC')) : Array.isArray(v) ? v.some(scan) : v !== null && typeof v === 'object' ? Object.values(v).some(scan) : false;
  if (scan(value)) throw new ContentPolicyError('Content violates the vegetarian-only store policy.');
  if (!imageReviewed) throw new ContentPolicyError('A staff member must inspect every image before publication.');
}
