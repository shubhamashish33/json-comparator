// Use the Babel toolchain already supplied by react-scripts; no browser required.
process.env.NODE_ENV = "production";
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");
const craRequire = createRequire(require.resolve("react-scripts/package.json"));
const presetRequire = createRequire(craRequire.resolve("babel-preset-react-app/package.json"));
const babel = craRequire("@babel/core");
const originalLoader = require.extensions[".js"];
const sourceRoot = path.resolve(__dirname, "../src") + path.sep;
require.extensions[".js"] = (module, filename) => {
  if (!filename.startsWith(sourceRoot)) return originalLoader(module, filename);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, babelrc: false, configFile: false,
    presets: [[presetRequire.resolve("@babel/preset-env"), { targets: { node: "current" }, modules: "commonjs" }], [presetRequire.resolve("@babel/preset-react"), { runtime: "automatic" }]],
  });
  module._compile(code, filename);
};
const React = require("react");
const { renderToString } = require("react-dom/server");
const { StaticRouter } = require("react-router-dom");
const { pageMetadata, toolPages, SITE_URL } = require("../src/pageMetadata");
const HomePage = require("../src/HomePage").default;
const HelpPage = require("../src/HelpPage").default;
const { ToolPage } = require("../src/components/ToolPage");
const buildRoot = path.resolve(__dirname, "../build");
const template = fs.readFileSync(path.join(buildRoot, "index.html"), "utf8");
const escape = text => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
for (const page of Object.values(pageMetadata)) {
  let content = null;
  if (page.path === "/") content = React.createElement(HomePage);
  else if (page.path === "/help") content = React.createElement(HelpPage);
  else if (toolPages.some(item => item.path === page.path)) content = React.createElement(ToolPage, { page });
  const markup = content ? renderToString(React.createElement(StaticRouter, { location: page.path }, content)) : "";
  const url = SITE_URL + page.path;
  let html = template.replace(/<title>[^]*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
    .replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  for (const [attribute, key, value] of [["name", "description", page.description], ["property", "og:title", page.title], ["property", "og:description", page.description], ["property", "og:url", url], ["name", "twitter:title", page.title], ["name", "twitter:description", page.description], ["name", "twitter:url", url]]) {
    html = html.replace(new RegExp(`(<meta\\s+${attribute}="${key}"\\s+content=")[^"]*(")`), `$1${escape(value)}$2`);
  }
  html = html.replace(/<script type="application\/ld\+json">[^]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebApplication", name: "JSONEditor", url, description: page.description, applicationCategory: "DeveloperApplication", operatingSystem: "Any", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }).replace(/</g, "\\u003c")}</script>`);
  if (!html.includes(`<title>${escape(page.title)}</title>`) || !html.includes(`href="${url}"`) || (content && !html.includes("<h1"))) throw Error("Prerender verification failed: " + page.path);
  const output = page.path === "/" ? buildRoot : path.join(buildRoot, page.path.slice(1));
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "index.html"), html);
}
require.extensions[".js"] = originalLoader;
console.log(`Prerendered ${Object.keys(pageMetadata).length} routes with unique metadata.`);
