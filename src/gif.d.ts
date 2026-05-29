declare module "gif.js" {
  export default class GIF {
    constructor(options: any);
    addFrame(canvas: any, options?: any): void;
    on(event: string, callback: any): void;
    render(): void;
  }
}
