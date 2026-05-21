# SmartRent dev sandbox

This directory is the isolated Homebridge user-storage path used by `npm run watch`.

It is mounted by:

```sh
homebridge -U ./test/hbConfig -D
```

`config.json` is checked in with a placeholder SmartRent platform stanza so that
launching the dev bridge surfaces the custom UI flow (login form). Everything
else Homebridge writes here at runtime — `auth.json`, `accessories/`,
`persist/`, `smartrent/session.json`, `homebridge-debug.log`, etc. — is
git-ignored.

To start the sandbox:

```sh
npm run watch
```

Then open the config-ui-x dashboard at <http://localhost:8581> and configure the
SmartRent plugin via its custom UI. Credentials and session data live here and
never leave your machine.
