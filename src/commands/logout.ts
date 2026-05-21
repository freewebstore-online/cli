/**
 * `fws logout`
 *
 * Clears the local auth file. Does NOT call GitHub to uninstall the App
 * — that's the designer's call from github.com/settings/installations.
 * This just makes the local CLI forget the installation_id.
 */

import { Command } from "commander";
import { authPath, clearAuth } from "../lib/config.js";

export const logoutCommand = new Command("logout")
  .description("Clear the local auth file (does not uninstall the GitHub App)")
  .action(() => {
    const removed = clearAuth();
    if (removed) {
      console.log(`✓ Removed ${authPath()}`);
      console.log("");
      console.log("To fully revoke access, also uninstall the FreeWebStore Templates");
      console.log("GitHub App at https://github.com/settings/installations");
    } else {
      console.log("No auth file to remove. You weren't logged in.");
    }
  });
