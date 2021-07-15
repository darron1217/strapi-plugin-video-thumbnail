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

    if(videoData.provider !== 'local' && !videoData.url) {
      // If the file is not local and there's no url then we can't generate a thumbnail
      return;
    }

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

async function getVideo(videoPath, savePath) {
  return new Promise((resolve, reject) => {
    let tempFile = fs.createWriteStream(savePath);
    const request = http.get(videoPath, function(response) {
      response.pipe(tempFile);
      response.on('end', () => {
        resolve()
      });
      response.on('error', (e) => {
        console.error("Cannot download file", e)
        reject()
      })
    });

  })
}

const getScreenshot = (videoData) =>
  new Promise(async (resolve, reject) => {
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
    try {

    if(videoData.provider !== 'local' && videoData.url) {
      //Fetch the video and store in tmp directory
      videoPath = path.join(tmpPath, videoData.hash + videoData.ext);
      await getVideo(videoData.url, videoPath);
     
    } else {
      videoPath = path.join(
        publicPath,
        `/uploads/${videoData.hash}${videoData.ext}`,
      );
    }

    // Take screenshot
    
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
