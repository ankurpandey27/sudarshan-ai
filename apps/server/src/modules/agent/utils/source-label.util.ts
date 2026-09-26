export const sourceLabel = (source: string): string =>
  ({ linkedin: 'LinkedIn', naukri: 'Naukri', web: 'your job links' })[source] ?? source;
