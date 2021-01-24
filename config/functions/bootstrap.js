const ffmpeg = require('fluent-ffmpeg');

module.exports = () => {
  // inject lifecycle hook
  // TODO : Find better way to trigger thumbnail generation
  const {beforeCreate, ...lifecycles} = strapi.plugins.upload.models.file.lifecycles || {}
  const {generateThumbnail} = strapi.plugins['video-thumbnail'].services[
    'video-thumbnail'
    ];

  strapi.plugins.upload.models.file.lifecycles = {
    ...lifecycles,
    async beforeCreate(data) {
      // run original method (if exists)
      if(beforeCreate) {
        beforeCreate(data);
      }

      // Run if file type is video
      if(data.mime.startsWith('video')) {
        await generateThumbnail(data);
      }
    },
  };
};
