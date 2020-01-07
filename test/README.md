# Tests

When filing bugs, if it's an inlining issue, ensure you include full test source to work against.

This can be via a [PR](https://github.com/tauri-apps/tauri-inliner/pulls) or by linking to a [gist](https://gist.github.com) that include at least **two** (first) files:

- `<issue>.src.html`
- `<issue>.result.html`

When these are put in the [fixtures](https://github.com/tauri-apps/tauri-inliner/tree/master/test/fixtures) directory, they are automatically tested against.

If there are any external assets the example needs, please also include these and name them with the same root as your example, i.e. `<issue>.css` or `<issue>.min.js` etc.

In addition `<issue>.opts.json` can be loaded to help specify runtime options during the test.

**To test a single fixture you can use:**:

```bash
$ FILTER=<issue> npm test
```
