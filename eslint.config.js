export default [
  { ignores: ["test_eslint.js"] }, // fixture cố ý chứa lỗi — chứng minh config bắt no-undef
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Math: "readonly",
        Object: "readonly",
        Array: "readonly",
        String: "readonly",
        Number: "readonly",
        Boolean: "readonly",
        Date: "readonly",
        Set: "readonly",
        Map: "readonly",
        JSON: "readonly",
        Promise: "readonly",
        parseInt: "readonly",
        parseFloat: "readonly",
        isNaN: "readonly",
        isFinite: "readonly",
        encodeURIComponent: "readonly",
        decodeURIComponent: "readonly",
        prompt: "readonly",
        confirm: "readonly",
        requestAnimationFrame: "readonly"
      }
    },
    rules: {
      "no-undef": "error"
    }
  },
  {
    files: ["test/**"],
    languageOptions: { globals: { process: "readonly" } }
  },
  {
    files: ["audio.js"],
    languageOptions: { globals: { URL: "readonly", Audio: "readonly" } }
  }
];
