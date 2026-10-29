# Landing site and repository presentation

The landing page and README share the promise: **From renovation idea to a quote-ready plan.** Both distinguish current local capabilities from planned external-agent and commerce workflows.

## Local preview

```bash
npm run dev
# http://127.0.0.1:8741/landing.html — landing
# http://127.0.0.1:8741/ — workspace
```

## Static Pages package

```bash
npm run build:pages
```

This builds and validates the product, then creates `pages-dist/` with the landing page at `index.html` and the workspace at `workspace.html`. Relative asset links support a GitHub project path. The original local opening stays unchanged. `.nojekyll` is included; generated output is ignored by Git.

The package is static. It cannot host MongoDB, the local API, private credentials, or Muse execution. The public prototype uses browser-local storage unless a separately authorized connected service is configured. Never include local credentials, property exports, or database files in a publication artifact.

## Publication status

The repository is `dabidoe/unpermitted-ai`, public, with `main` as its default branch. The active GitHub Pages source/configuration has not been verified. This change prepares source and a static output directory; it does not change a remote branch, README, or deployed site.

Before publication, verify the repository's Pages source and deploy this generated artifact through that configured route. The working tree contains substantial preexisting backend changes; review the intended files rather than indiscriminately committing the entire directory.
