// Re-export the native module. On web, it will be resolved to BrandedVideoModule.web.ts
// and on native platforms to BrandedVideoModule.ts
export { default } from './src/BrandedVideoModule';
export * from './src/BrandedVideo.types';
