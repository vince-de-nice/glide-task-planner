/** @type {import('fantasticon').RunnerOptions} */
module.exports = {
  name: 'vavicons',
  inputDir: 'public/icons/vavicons',
  outputDir: 'public/fonts',
  fontTypes: ['woff2', 'woff'],
  assetTypes: ['css'],
  formatOptions: {
    woff2: { flatten: true },
    woff: { flatten: true }
  },
  normalize: true,
  fontHeight: 1024,
  descent: 128,
  prefix: 'pi-vav',
  tag: 'i',
  templates: {
    css: './scripts/vavicons.css.hbs'
  },
  pathOptions: {
    css: 'src/styles/vavicons.css'
  },
  fontsUrl: '/fonts'
};
