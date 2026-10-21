import fs from 'fs';

async function extract() {
  console.log('Fetching film RSS feed (external) for user jpcmpc23...');
  const res = await fetch('https://letterboxd.com/jpcmpc23/rss/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const xml = await res.text();

  const items = xml.split('<item>').slice(1);
  console.log('Found', items.length, 'items in RSS.');

  const parsed = items.map((item, idx) => {
    const getTag = (tag) => {
      const m = item.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
      return m ? m[1].trim() : null;
    };
    const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/s)?.[1] || '';
    const posterMatch = desc.match(/<img src="([^"]+)"/)?.[1] || null;
    let textMatch = desc.replace(/<p><img[^>]+><\/p>/g, '').replace(/<[^>]+>/g, '').trim();
    const hasSpoilers = desc.includes('This review may contain spoilers');

    const tmdbId = Number(getTag('tmdb:movieId')) || 0;
    const ratingStr = getTag('letterboxd:memberRating');
    const rating = ratingStr ? parseFloat(ratingStr) : 0;
    const liked = getTag('letterboxd:memberLike') === 'Yes';
    const watchedDate = getTag('letterboxd:watchedDate') || '2026-07-01';
    const isRewatch = getTag('letterboxd:rewatch') === 'Yes';

    if (textMatch.startsWith('Watched on')) {
      textMatch = '';
    } else {
      textMatch = textMatch.replace('This review may contain spoilers.', '').trim();
    }

    return {
      id: `jpcmpc23-log-${idx + 1}`,
      movieId: tmdbId,
      movieTitle: getTag('letterboxd:filmTitle') || 'Untitled',
      moviePoster: posterMatch,
      movieYear: getTag('letterboxd:filmYear') || '',
      watchedDate,
      rating,
      isRewatch,
      liked,
      reviewText: textMatch,
      containsSpoilers: hasSpoilers,
      tags: [],
      createdAt: new Date(watchedDate).toISOString(),
    };
  });

  if (!fs.existsSync('src/data')) {
    fs.mkdirSync('src/data', { recursive: true });
  }

  fs.writeFileSync('src/data/jpcmpc23_logs.json', JSON.stringify(parsed, null, 2), 'utf-8');
  console.log('Saved', parsed.length, 'entries to src/data/jpcmpc23_logs.json');
}

extract().catch(console.error);
