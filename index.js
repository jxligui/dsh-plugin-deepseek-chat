/** Host half of the DeepSeek Chat bundle.
 *
 * Declares the plugin's user-facing configuration: two volatile booleans that
 * choose whether the panel appears in the left sidebar, the right sidebar, or
 * both. The Settings service projects volatile fields to the Plugins page, and
 * the Client half reads them live through `ctx.configForms`, so toggling takes
 * effect without a restart. At least one sidebar entry stays visible: the
 * Client treats "both off" as "left on", and the settings form refuses to turn
 * off the last enabled switch.
 */
import z from '@deepseek-ai/schemastery';

export const Config = z.object({
  showInLeftSidebar: z.boolean().default(true).volatile(),
  showInRightSidebar: z.boolean().default(true).volatile(),
});

export function apply() {}
