
# 1.0.0

1.0.0 is the first stable release provided
It includes features such as:
- allows you to choose which files you want to `ignore` from packaging
- in case you only want one file into packaging process, we also provided an
option that reverts `ignore` called `includeOnly`. That means that it **ALWAYS**
overlaps `ignore` option.
- definition of dependencies (as you would do on your `package.json`)
- definition of optional dependencies
- definition of *required* or *optional* dependencies per environment
