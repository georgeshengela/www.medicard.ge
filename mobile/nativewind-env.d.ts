/// <reference types="nativewind/types" />

// Metro turns the Tailwind entry point into a side-effect import that TypeScript
// cannot resolve on its own.
declare module '*.css';
