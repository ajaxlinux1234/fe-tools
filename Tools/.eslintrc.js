module.exports = {
    extends: ["prettier", "prettier/vue"],
    parserOptions: {
        ecmaFeatures: {
            legacyDecorators: true
        }
    },
    rules: {
        "prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
        "react/no-string-refs": ["warn"]
    },
    globals: {
        g_config: true,
        g_apps: true
    }
};