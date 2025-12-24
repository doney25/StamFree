/**
 * Jest Configuration
 * 
 * Configures Jest for testing with TypeScript and path aliases.
 * Simple setup for pure function tests without React Native dependencies.
 */

export default {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  
  // Path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  
  // TypeScript support
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs', // Use commonjs for Jest compatibility
      },
    }],
  },
  
  // Ignore React Native setup files
  testPathIgnorePatterns: ['/node_modules/', 'node_modules/react-native/jest/setup.js'],
};
