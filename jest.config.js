/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  collectCoverage: false,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: false
    }
  },
  verbose: true,
  // Optional but helpful
  mapCoverage: true
};
