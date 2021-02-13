# Strapi plugin video-thumbnail

Add video thumbnail functionality to Strapi upload plugin.

**This plugin works only if [FFmpeg](https://ffmpeg.org/) is installed on the server.**

# Install
```
npm install strapi-plugin-video-thumbnail
```

or

```
yarn add strapi-plugin-video-thumbnail
```

# Supported Providers
- [x] Local
- [ ] AWS S3

# How does this plugin works?
1. This plugin overrides Upload model's `beforeCreate` database lifecycle hook on [bootstrap.js](https://github.com/darron1217/strapi-plugin-video-thumbnail/blob/main/config/functions/bootstrap.js)
2. Take a screenshot of video. (Using `FFMPEG`)
3. Generate thumbnails of screenshot. (Using upload plugin's methods)
4. That's it :)

# License
MIT
