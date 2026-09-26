export enum JobStatus {
  NEW = 'new',
  SKIPPED = 'skipped',
  REVIEW = 'review',
  APPROVED = 'approved',
  APPLYING = 'applying',
  NEEDS_INPUT = 'needs_input',
  APPLIED = 'applied',
  /** Needs to be finished by hand (captcha, unsupported site). */
  MANUAL = 'manual',
  FAILED = 'failed',
  DISMISSED = 'dismissed',
}
