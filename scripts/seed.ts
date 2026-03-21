import { pool } from '../src/lib/db';
import { logger } from '../src/lib/logger';

async function seed() {
  const samples = [
    {
      title: '如何写出爆款小红书笔记？',
      body_text: '这是关于小红书写作技巧的干货分享...',
      source_url: 'https://www.xiaohongshu.com/explore/1',
      manual_tags: ['职场', '干货'],
    },
    {
      title: '职场人必看的 5 个效率工具',
      body_text: '提升工作效率，这几个工具你一定要知道...',
      source_url: 'https://www.xiaohongshu.com/explore/2',
      manual_tags: ['工具', '效率'],
    },
    {
      title: '我的 2024 年成长复盘',
      body_text: '回顾过去一年，我学到了这些...',
      source_url: 'https://www.xiaohongshu.com/explore/3',
      manual_tags: ['成长', '复盘'],
    },
  ];

  try {
    for (const sample of samples) {
      await pool.query(
        'INSERT INTO samples (title, body_text, source_url, manual_tags) VALUES ($1, $2, $3, $4) ON CONFLICT (source_url) DO NOTHING',
        [sample.title, sample.body_text, sample.source_url, sample.manual_tags]
      );
    }
    logger.info('Seed data inserted successfully');
  } catch (err) {
    logger.error({ err }, 'Seed failed');
  } finally {
    await pool.end();
  }
}

seed();
