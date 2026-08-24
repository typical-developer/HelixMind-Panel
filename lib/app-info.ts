/**
 * Identity of the running build.
 *
 * Kept as constants rather than imported from `package.json` so the version
 * string does not drag the whole manifest into the client bundle. Bump
 * `APP_VERSION` alongside the one in `package.json`.
 */
export const APP_NAME = "HelixMind Panel"
export const APP_VERSION = "0.1.0"

/**
 * Where a bug report should be sent.
 *
 * Reports are assembled in the browser and handed to the operator to copy,
 * download or open in their mail client. Nothing is transmitted by the panel
 * itself — there is no support endpoint in the API, and a form that claimed to
 * file a ticket without filing one would be exactly the kind of thing this
 * pass exists to remove.
 */
export const SUPPORT_EMAIL = "support@helixmind.example"

/** Shown in the help menu so the operator knows what they are running. */
export const BUILD_LABEL = `${APP_NAME} ${APP_VERSION}`
