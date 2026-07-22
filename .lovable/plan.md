Append the provided iOS rewarded ad unit ID to the existing `.env` file at the project root:

```text
VITE_ADMOB_REWARDED_IOS=ca-app-pub-3258624574726151/7452768548
```

The `VITE_` prefix ensures the value is exposed to client code, which `src/game/rewardedAd.ts` already reads via `import.meta.env.VITE_ADMOB_REWARDED_IOS`. The existing AdMob integration in the project will pick this up on the next native build. No other files need to change.