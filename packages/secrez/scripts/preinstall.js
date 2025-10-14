if (process.env.npm_execpath.indexOf("pnpm") === -1) {
  console.error(
    "\x1b[31m\x1b[1m%s\x1b[0m",
    '\nThis project requires pnpm as a package manager.\n'
  );
  process.exit(1);
}
