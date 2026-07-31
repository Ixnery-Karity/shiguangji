// utils/mock.js —— 本地演示数据
// 作用：云开发未就绪时，页面回退到这份 mock 数据，保证 UI/流程可跑通。
// 这份数据也可被 seed 云函数复用，写入云数据库作为初始种子。

const CATEGORIES = ['全部', '教材', '数码', '生活', '美妆', '卡券', '其他'];

// v0.4.0：成色筛选项与热门搜索词（热词后续可由云端搜索日志聚合替代）
const CONDITIONS = ['全部', '全新', '九成新', '八成新', '七成新及以下'];
const HOT_WORDS = ['高数', '耳机', '自行车', '四六级', '考研', '口红', '笔记本'];

const ITEMS = [
  {
    _id: 'm1', title: '高等数学 同济第七版 上册 九成新无笔记',
    desc: '正版教材，仅翻阅几次，无划线笔记，无缺页。毕业清仓，诚心可小刀，宿舍楼下当面交易。',
    price: 15, originPrice: 42, category: '教材', condition: '九成新',
    cover: '📘', images: ['📘', '📗', '📙'], location: '3号宿舍楼',
    sellerName: '王同学', sellerVerified: true, sellerCredit: '成交28笔·好评98%',
    status: '在售', views: 156, createdAt: Date.now() - 3600 * 1000 * 2
  },
  {
    _id: 'm2', title: '索尼降噪耳机 WH-1000XM4 自用无拆修',
    desc: '去年买的，音质降噪都很好，配件齐全，因换新出。支持当面验货。',
    price: 680, originPrice: 1899, category: '数码', condition: '九成新',
    cover: '🎧', images: ['🎧'], location: '图书馆',
    sellerName: '李同学', sellerVerified: true, sellerCredit: '成交12笔·好评100%',
    status: '在售', views: 89, createdAt: Date.now() - 3600 * 1000 * 5
  },
  {
    _id: 'm3', title: '通勤自行车 捷安特 可议价',
    desc: '骑了一年，车况良好，刹车灵敏。毕业不带走了，校内自提。',
    price: 220, originPrice: 600, category: '生活', condition: '七成新',
    cover: '🚲', images: ['🚲'], location: '东门',
    sellerName: '张同学', sellerVerified: true, sellerCredit: '成交5笔·好评95%',
    status: '在售', views: 47, createdAt: Date.now() - 3600 * 1000 * 8
  },
  {
    _id: 'm4', title: '全新口红 色号#12 未拆封',
    desc: '买多了，全新未拆，专柜正品。可当面看。',
    price: 60, originPrice: 320, category: '美妆', condition: '全新',
    cover: '💄', images: ['💄'], location: '5号宿舍楼',
    sellerName: '陈同学', sellerVerified: true, sellerCredit: '成交9笔·好评97%',
    status: '在售', views: 62, createdAt: Date.now() - 3600 * 1000 * 12
  },
  {
    _id: 'm5', title: 'ThinkPad X1 i5 办公够用',
    desc: '轻薄本，办公写代码够用，电池健康度良好。可当面开机验机。',
    price: 2100, originPrice: 6999, category: '数码', condition: '八成新',
    cover: '💻', images: ['💻'], location: '研究生公寓',
    sellerName: '赵同学', sellerVerified: true, sellerCredit: '成交3笔·好评100%',
    status: '在售', views: 133, createdAt: Date.now() - 3600 * 1000 * 20
  },
  {
    _id: 'm6', title: '考研英语真题 全套+笔记',
    desc: '考研上岸出，真题全套加手写笔记，祝有缘人成功。',
    price: 35, originPrice: 150, category: '教材', condition: '九成新',
    cover: '📗', images: ['📗'], location: '2号宿舍楼',
    sellerName: '孙同学', sellerVerified: true, sellerCredit: '成交6笔·好评96%',
    status: '在售', views: 74, createdAt: Date.now() - 3600 * 1000 * 26
  }
];

module.exports = { CATEGORIES, CONDITIONS, HOT_WORDS, ITEMS };
