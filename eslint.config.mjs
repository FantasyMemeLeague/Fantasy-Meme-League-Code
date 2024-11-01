import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  // Configure ES module settings for JavaScript files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",       // Use the latest ECMAScript version
      sourceType: "module",        // Set to module for ES module syntax
      globals: globals.node        // Use Node.js globals
    },
  },
  pluginJs.configs.recommended
];
