import { pool } from '../src/lib/db';
import { logger } from '../src/lib/logger';

async function seed() {
  const samples = [
    {
      title: '总被说表达不清？我靠这 3 步把汇报效率提上来了',
      body_text: '以前我每次汇报都像想到什么说什么，领导经常听完还要追问重点。后来我把表达拆成结论、依据、行动三步，汇报时间缩短了，沟通成本也降下来了。本文整理了我的具体做法和踩过的坑。',
      source_url: 'https://www.xiaohongshu.com/explore/1',
      manual_tags: ['职场', '表达'],
    },
    {
      title: '职场人必看的 5 个效率工具，我每天都在用',
      body_text: '如果你总觉得事情很多、时间不够，先别急着逼自己更努力。真正拉开差距的，往往是任务管理、信息收集和复盘方式。我把最近一年稳定在用的 5 个效率工具整理成了一篇收藏向清单。',
      source_url: 'https://www.xiaohongshu.com/explore/2',
      manual_tags: ['工具', '效率'],
    },
    {
      title: '我的 2024 年成长复盘：真正让我进步的不是努力，是停止内耗',
      body_text: '回顾过去一年，我发现真正有效的成长，来自几次关键选择：停止无效社交、减少情绪内耗、把行动拆到最小步。这里不是鸡汤，而是我自己验证过后留下来的 6 个变化。',
      source_url: 'https://www.xiaohongshu.com/explore/3',
      manual_tags: ['成长', '复盘'],
    },
    {
      title: '被领导催进度时，别急着解释，这个回复模板真的有用',
      body_text: '很多人一被催就开始解释客观原因，但对方真正想知道的是风险、节点和下一步。我把自己最常用的一套回复结构整理出来，适合项目汇报、跨部门协作和日常推进。',
      source_url: 'https://www.xiaohongshu.com/explore/4',
      manual_tags: ['职场', '沟通'],
    },
    {
      title: '适合普通人的早起方案，不自律也能坚持的版本',
      body_text: '以前我试过很多极端早起法，最后都反弹。后来我只改了三件小事：提前一小时降噪、固定起床触发器、把晨间任务减少到两件。这个版本对普通上班族更友好，也更容易坚持。',
      source_url: 'https://www.xiaohongshu.com/explore/5',
      manual_tags: ['自律', '习惯'],
    },
    {
      title: '做副业前先别辞职，这 4 个判断能帮你少走很多弯路',
      body_text: '副业不是不能做，但很多人是在高情绪状态下做决定，结果投入了时间和金钱，最后两头都顾不好。本文从现金流、体力、试错成本和可复制性四个角度，讲清楚什么时候适合开始。',
      source_url: 'https://www.xiaohongshu.com/explore/6',
      manual_tags: ['副业', '决策'],
    },
    {
      title: '我把周报改成这 3 个模块后，领导终于开始认真看了',
      body_text: '以前的周报像流水账，写得很累，看的人也抓不到重点。后来我统一成结果、问题、下周计划三个模块，强调结论前置和可交付物，周报从应付差事变成了沟通工具。',
      source_url: 'https://www.xiaohongshu.com/explore/7',
      manual_tags: ['周报', '职场'],
    },
    {
      title: '预算不高也能把房间布置得很舒服，这 7 个细节最值',
      body_text: '租房党最怕花了钱却还是乱。其实只要先处理灯光、收纳、布料和颜色统一度，空间质感会立刻变好。我整理了自己几次改造中性价比最高的 7 个改动。',
      source_url: 'https://www.xiaohongshu.com/explore/8',
      manual_tags: ['家居', '租房'],
    },
    {
      title: '不会做复杂攻略也没关系，周末短途旅行这样安排就够了',
      body_text: '我现在做短途旅行攻略，只会先定一个核心目标，再围绕交通、吃饭和休息三个问题做最小计划。这个方法特别适合没时间做攻略、又不想行程太乱的人。',
      source_url: 'https://www.xiaohongshu.com/explore/9',
      manual_tags: ['旅行', '攻略'],
    },
    {
      title: '普通女生也能穿出利落感，我总结了通勤穿搭的 5 条公式',
      body_text: '我以前总觉得通勤穿搭要么太正式，要么太普通。后来我开始从颜色、版型和配饰统一度入手，搭出了一套不费力但很有精神的通勤公式，适合预算有限又想提升气质的人。',
      source_url: 'https://www.xiaohongshu.com/explore/10',
      manual_tags: ['穿搭', '通勤'],
    },
    {
      title: '写简历时最容易忽略的一点：不是写做过什么，而是写成效',
      body_text: '很多简历最大的问题不是内容不够多，而是看不出结果。我把自己帮朋友改简历时最常用的方法整理成了四步：删流水账、补指标、强调动作、统一结构。',
      source_url: 'https://www.xiaohongshu.com/explore/11',
      manual_tags: ['求职', '简历'],
    },
    {
      title: '情绪低落时别急着逼自己振作，我靠这个复盘模板慢慢走出来',
      body_text: '情绪波动最怕的不是难受，而是难受的时候还觉得自己不该难受。我现在会用一个很轻量的复盘模板记录触发点、身体感受和可以做的一件小事，这个方式比单纯鼓励自己更有效。',
      source_url: 'https://www.xiaohongshu.com/explore/12',
      manual_tags: ['情绪', '复盘'],
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
  } finally {
    await pool.end();
  }
}

void seed().catch((error: unknown) => {
  logger.error({ error }, 'Seed failed');
  process.exit(1);
});
