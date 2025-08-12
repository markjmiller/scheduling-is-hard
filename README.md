# Scheduling Is Hard

Mutually find availability with any number of people.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/markjmiller/scheduling-is-hard)

Scheduling with friends is hard. This app is designed to get mutual availability for any number of people, quickly. A host can create an event and then create as many unique links as they want to send out to guests. Invited guests submit their availability and a calendar heatmap of availability is displayed to everyone.

### Create events
![create-event](./images/create-event.png)

### Add availability
![guest-availability](./images/guest-availability.png)

### See mutual availability
![mutual-availability](./images/mutual-availability.png)

### Manage guests
![manage-guests](./images/manage-guests.png)

## Docs

- [API](./schemas/api.yaml)
- [Requirements](./REQUIREMENTS.md)
- [Architecture](./ARCHITECTURE.md)

## Dev

| Command | Description |
|---------|-----------|
| `npm run dev` | **Start development server** - Most commonly used for local development |
| `npm run deploy-preview` | **Deploy to Cloudflare** - Push your changes to a new version on staging |
| `npm run deploy-staging` | **Deploy to Cloudflare** - Push your changes to staging |
| `npm run deploy-production` | **Deploy to Cloudflare** - Push your changes to production |
| `npm run build` | **Build for production** - Compile TypeScript, bundle assets, and generate API docs |
| `npm run check` | **Pre-deployment validation** - Verify code compiles and deployment readiness |
| `npm run lint` | **Format code** - Auto-format source code with Prettier |
| `npm run preview` | **Preview built app** - Test the production build locally |
| `npm run generate-types` | **Generate TypeScript types** - Run when OpenAPI schema is modified |
| `npm run cf-typegen` | **Generate Worker types** - Run when new Cloudflare bindings are added |
| `npm run lint-openapi` | **Validate OpenAPI schema** - Check API documentation for errors |
| `npm run preview-openapi` | **Preview API docs** - View OpenAPI documentation in browser |

## Workers Builds

To set up PR previews on staging (creates new versions and branch urls on the staging Worker while keeping the production Worker's versions clean), these build settings were set up in the Cloudflare Workers dashboard:

### Staging

- Branch: main
- Build command: (blank)
- Enable non-production branch builds: Unchecked
- Deploy command: npm run deploy-staging
- Non-production branch deploy command: npm run deploy-preview

### Production

- Branch: main
- Build command: (blank)
- Enable non-production branch builds: Unchecked
- Deploy command: npm run deploy-production
