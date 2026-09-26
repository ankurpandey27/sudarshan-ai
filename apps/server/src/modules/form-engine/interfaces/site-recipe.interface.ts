/** Button labels that open and advance a site's form, learned on the first visit. */
export interface SiteRecipe {
  domain: string;
  applyTexts: string[];
  advanceTexts: string[];
  successes: number;
  failures: number;
}
