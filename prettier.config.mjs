// Mirrors the odata2ts project standard (printWidth 120, formatted package.json).
// The import-sorting plugin used elsewhere is omitted - this repo has no TypeScript sources.
export default {
  plugins: ["prettier-plugin-packagejson"],
  printWidth: 120,
  tabWidth: 2,
  semi: true,
};
