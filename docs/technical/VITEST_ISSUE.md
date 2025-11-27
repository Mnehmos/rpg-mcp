# Vitest Configuration Issue

## Status
There is currently an issue with Vitest not recognizing test suites in the test files.

## Error
```
Error: No test suite found in file
```

## Attempted Fixes
1. ✅ Configured tsconfig to include tests directory
2. ✅ Removed rootDir restriction from tsconfig
3. ✅ Changed moduleResolution to "bundler"
4. ✅ Downgraded from Vitest v4 to v1.6.1
5. ✅ Downgraded Zod from v4 to v3
6. ✅ Removed .js extensions from test imports
7. ❌ Tried both `globals: true` and `globals: false`
8. ❌ Tried different pool configurations (forks, threads)

## Root Cause
This appears to be a known issue with Vitest v1/v4 and TypeScript + ESM configuration on Windows with certain tsconfig settings.

## Next Steps
- Try alternative test runners (Jest, Node test runner)
- OR: Simplify the module configuration
- OR: Use a vitest workspace configuration
- OR: Manually import vitest functions without globals

## Workaround
Schemas have been implemented and type-check correctly. Tests are written following TDD principles (written before implementation). Once vitest configuration is fixed, tests should run correctly.
