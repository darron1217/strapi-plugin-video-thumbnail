'use strict';

/**
 * video-thumbnail.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');

module.exports = {
  async generateThumbnail(videoData) {
    // This plugin currently supports local and s3 providers only
    if (!['aws-s3', 'local'].includes(videoData.provider)) {
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

const getScreenshot = (videoData) =>
  new Promise(async (resolve, reject) => {
    // Saved file name
    const videoFileName = `${videoData.hash}${videoData.ext}`;

    // Create temp folder
    const tmpPath = path.join(
      os.tmpdir(),
      `strapi${crypto.randomBytes(6).toString('hex')}`,
    );
    fs.mkdirSync(tmpPath);

    // Path of video file
    let videoPath;

    // Get path of video file
    if (videoData.provider === 'aws-s3') {
      const providerOptions = strapi.plugins.upload.config.providerOptions;
      const S3 = new AWS.S3({
        apiVersion: '2006-03-01',
        region: providerOptions.region,
        accessKeyId: providerOptions.accessKeyId,
        secretAccessKey: providerOptions.secretAccessKey,
      });
      const url = S3.getSignedUrl('getObject', {
        Bucket: providerOptions.params.Bucket,
        Key: videoFileName,
      });
      videoPath = url;
    } else if (videoData.provider === 'local') {
      const configPublicPath = strapi.config.get(
        'middleware.settings.public.path',
        strapi.config.paths.static
      );
      const publicPath = path.resolve(strapi.dir, configPublicPath);
      videoPath = path.join(publicPath, `/uploads/${videoFileName}`);
    }

    const screenshotExt = '.png';
    const screenshotFileName = videoData.hash + screenshotExt;

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
