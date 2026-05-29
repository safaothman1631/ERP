/**
 * RSS feed for the blog (English locale).
 */
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Kurdish ERP — Blog',
    description: 'Guides on accounting, POS, taxes, and e-Fakhata for Iraqi small and mid-size businesses.',
    site: context.site ?? 'https://zoho-kurdish.iq',
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/blog/${post.slug}`,
      author: post.data.author,
      categories: post.data.tags,
    })),
    customData: '<language>en-US</language>',
  });
}
