'use strict';

/**
 * video-thumbnail.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

 const http = require('https');
 const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');

module.exports = {
  async generateThumbnail(videoData) {

    const screenshotData = await getScreenshot(videoData);

    if (screenshotData) {
      // Image manipulation process (same as upload plugin)
      const {
        getDimensions,
        generateThumbnail,
        generateResponsiveFormats,
      } = strapi.plugins.upload.services['image-manipulation'];

      const thumbnailFile = await generateThumbnail(screenshotData);
      if (thumbnailFile) {
        await strapi.plugins.upload.provider.upload(thumbnailFile);
        delete thumbnailFile.buffer;
        _.set(videoData, 'formats.thumbnail', thumbnailFile);
      }

      const formats = await generateResponsiveFormats(screenshotData);
      if (Array.isArray(formats) && formats.length > 0) {
        for (const format of formats) {
          if (!format) continue;

          const {key, file} = format;

          await strapi.plugins.upload.provider.upload(file);
          delete file.buffer;

          _.set(videoData, ['formats', key], file);
        }
      }

      const {width, height} = await getDimensions(screenshotData.buffer);

      _.assign(videoData, {
        width,
        height,
      });
    }
  },
};

const getScreenshot = (videoData) =>
  new Promise((resolve, reject) => {
    // Get video path
    const configPublicPath = strapi.config.get(
      'middleware.settings.public.path',
      strapi.config.paths.static,
    );
    const publicPath = path.resolve(strapi.dir, configPublicPath);
    var videoPath;

    // Create temp folder
    const tmpPath = path.join(
      os.tmpdir(),
      `strapi${crypto.randomBytes(6).toString('hex')}`,
    );
    fs.mkdirSync(tmpPath);

    const screenshotExt = '.png';
    const screenshotFileName = videoData.hash + screenshotExt;

    if(videoData.provider !== 'local') {
      videoPath = fs.createWriteStream(path.join(tmpPath, videoData.name));
      const request = http.get(videoData.path, function(response) {
        response.pipe(file);
      });
    } else {
      videoPath = path.join(
        publicPath,
        `/uploads/${videoData.hash}${videoData.ext}`,
      );
    }

    // Take screenshot
    try {
      ffmpeg(videoPath)
        .screenshots({
          count: 1,
          filename: screenshotFileName,
          folder: tmpPath,
        })
        .on('end', () => {
          fs.readFile(path.join(tmpPath, screenshotFileName), (err, buffer) => {
            resolve({
              name: screenshotFileName,
              hash: videoData.hash,
              path: videoData.path,
              ext: screenshotExt,
              mime: 'image/png',
              buffer,
            });
          });
        });
    } catch (e) {
      reject(e);
    }

    // clean up
    fs.rmdir(tmpPath, () => {});
  });
