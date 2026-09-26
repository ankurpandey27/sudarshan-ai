export const LINKEDIN_SCOPE = '.jobs-easy-apply-modal, [data-test-modal-id="easy-apply-modal"], div[role="dialog"]';
export const LINKEDIN_SUCCESS = /your application was sent|application (was )?sent to|application submitted|you applied to/i;
export const LINKEDIN_APPLIED = /\bapplied \d+ (second|minute|hour|day|week|month)s? ago\b|application submitted|see application/i;
export const CLOSED_TEXT = /no longer accepting applications|job (has )?expired|this job is (no longer available|closed)|position has been filled|job is not available/i;

export const NAUKRI_DRAWER = '.chatbot_DrawerContentWrapper, [class*="chatbot_Drawer"], [class*="chatbot-drawer"]';
export const NAUKRI_SUCCESS = /you have successfully applied|successfully applied|applied successfully|application (has been )?(sent|submitted)/i;

export const GENERIC_SUCCESS =
  /thank(s| you) for (applying|your application|your interest)|application (has been |was )?(received|submitted|sent)|successfully (applied|submitted)|we('ve| have) received your application|you('ve| have) applied/i;

export const LOGIN_WALL = /sign in to (apply|continue)|log ?in to (apply|continue)|create an account to apply|please (sign|log) in/i;
