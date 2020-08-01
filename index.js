const Instagram = require('./telegram-web-api');
const axios = require('axios');
const cheerio = require('cheerio');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');

const client = new Instagram({ username: 'username', password: 'password' });

const fetchTags = async (link) => {
  const res = await axios.get(link);
  const data = await res.data;

  const $ = cheerio.load(data);
  const tags = $('div.shot-tags > ol')
    .children()
    .get()
    .map((el) => `#${$(el).text().trim().replace(' ', '_')}`)
    .join(' ');

  return tags;
};

const fetchImages = async () => {
  const res = await axios.get('https://dribbble.com');
  const data = await res.data;

  const $ = cheerio.load(data);
  const parent = $('ol').children().get();
  const shots = parent.splice(1, parent.length - 2);

  return shots.map((el) => {
    const previewLink =
      'https://dribbble.com' + $(`#${el.attribs.id} > div > a`).attr('href');
    const id = el.attribs['data-screenshot-id'];
    const href = $(
      `#${el.attribs.id} > div > picture > source:first-child`
    ).attr('srcset');
    const author = $(`#${el.attribs.id} > div > div > a > span`).text();

    return { previewLink, id, href, author };
  });
};

const publishImages = (data, userMedia) => {
  let alreadyPublished = [];

  data.forEach((item, i) => {
    const { previewLink, id, author, href } = item;

    alreadyPublished = [];

    userMedia.forEach((el) => {
      const postDescription = el.node.edge_media_to_caption.edges[0].node.text;
      alreadyPublished.push(postDescription.includes(id));
    });

    !alreadyPublished.includes(true) &&
      setTimeout(() => {
        fetchTags(previewLink).then(async (tags) => {
          await nodeHtmlToImage({
            output: './image.jpg',
            html: `<img src="${href}" />`,
          });

          try {
            await client.uploadPhoto({
              photo: './image.jpg',
              caption: `Art by ${author}\n\n${tags} #${id}`,
              post: 'feed',
            });
          } catch (error) {
            console.log(error);
          }
          fs.unlink('./image.jpg', (err) => {
            if (err) console.log(err);
          });
        });
      }, i * 20000);
  });
};

const init = async () => {
  await client.login();

  const user = await client.getUserByUsername({
    username: 'username',
  });

  const userMedia = user.edge_owner_to_timeline_media.edges;
  userMedia.length = 10;

  const data = await fetchImages();
  data.length = 10;

  publishImages(data, userMedia);
};

init();
