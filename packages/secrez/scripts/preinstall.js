if (process.env.npm_execpath.indexOf("pnpm") === -1) {
  console.error(
    "\x1b[31m\x1b[1m\nThis project requires pnpm as a package manager.\n\x1b[0m"
  );
  process.exit(1);
}
