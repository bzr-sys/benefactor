# Benefactor

Membership app on Bazaar: creators run pages with monthly tiers and members-only posts, fans join, follow, like and comment.

## Data

Everything lives in each creator's own Bazaar DB. `src/lib/data.ts` sets the permissions when a creator opens the studio:

- `pages`, `posts`: public. Locked posts show title and teaser.
- `post_bodies`: public bodies, or bodies whose `tiers` contain one of the reader's purchased products (`$containsAny: "$purchases"`).
- `comments`, `likes`, `followers`: anyone signed in adds or removes their own.
- `_files` under `public/`: covers and post images.

Tiers are Bazaar products with `group` = page ID. A post locked to a tier unlocks for that tier and every pricier one; new tiers are added to matching posts.

Followed pages are kept in the fan's own `following` collection for the feed.

## Run locally

Needs the SDK from the sibling `bazaar/` monorepo, built once:

```sh
cd ../bazaar && pnpm --filter @bzr/bazaar-types --filter @bzr/bazaar run build
pnpm --filter @bzr/bazaar-frontend run build   # popups served by the mock
node mock/src/mock.ts -i benefactor -u http://localhost:5173
```

```sh
npm install
VITE_APP_ID=benefactor npm run dev
```

In mock mode, subscribing to a Creator plan and setting up payouts in the Bazaar popup complete immediately, and joining a tier needs no card.
