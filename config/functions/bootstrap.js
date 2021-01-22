module.exports = () => {
  // inject lifecycle hook
  // TODO : Find better way to trigger thumbnail generation
  const {beforeCreate, ...lifecycles} = strapi.plugins.upload.models.file.lifecycles || {}
  strapi.plugins.upload.models.file.lifecycles = {
    ...lifecycles,
    async beforeCreate(data) {
      // run original method (if exists)
      if(beforeCreate) {
        beforeCreate(data);
      }

      const {generateThumbnail} = strapi.plugins['video-thumbnail'].services[
        'video-thumbnail'
      ];
      await generateThumbnail(data);
    },
  };
};
