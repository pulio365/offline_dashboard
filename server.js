// ══════════════════════════════════════════════════════
//  Survey API Server  —  Node.js + Express + MySQL
//  파일: server.js
// ══════════════════════════════════════════════════════

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(express.json());

// ─── CORS ──────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "https://pulio365.cafe24.com",
      "https://puliodays.com",
      "https://m.puliodays.com",
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);

// ─── DB 연결 풀 ────────────────────────────────────────
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "survey_user",
  password: process.env.DB_PASSWORD || "your_password",
  database: process.env.DB_NAME || "survey_db",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

// ─── 슬랙 알림 ─────────────────────────────────────────
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";

const GENDER_LABEL = { male: "남성", female: "여성" };
const AGE_LABEL = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60plus": "60대 이상",
};
const PURPOSE_LABEL = {
  purchase: "구매",
  experience: "체험",
  gift: "선물",
  inquiry: "상담&문의",
};
const CAT_LABEL = {
  lower_body: "하체",
  back: "등허리",
  neck_shoulder: "목어깨",
  massage_gun: "마사지건",
  other: "기타",
};
const PRODUCT_LABEL = {
  pulizee: "풀리지 허벅지 마사지기",
  calf_v3: "종아리 마사지기 V3",
  pulition: "풀리션 마사지 부츠",
  mat: "마사지 매트",
  backpuller_v1: "백풀러 허리 마사지기",
  back_cushion: "등 허리 쿠션 마사지기",
  neck_tapping_v3: "목 어깨 두드림 마사지기 V3",
  neckpuller: "넥풀러 목 어깨 홈케어",
  thepillow: "더필로 마사지베개",
  neck_travel: "여행용 목 베개 마사지기",
  minimax: "미니맥스 마사지건",
  gun_belt: "마사지 건 & 벨트",
  turbofit: "터보핏 마사지건",
  wellwork: "풀리오 웰워크",
  hand_v1: "손 마사지기",
  pediplaner: "패디플래너",
  airgua: "에어괄사 마사지기",
};
const BUYPURPOSE_LABEL = {
  massage_strength: "마사지강도",
  design: "디자인만족",
  price: "합리적가격",
  gift_give: "선물용",
  other: "기타",
};
const ROUTE_LABEL = {
  sns: "SNS",
  search: "검색",
  friend: "지인추천",
  pass_by: "지나가다발견",
  existing: "기존이용자",
};
const STORE_LABEL = {
  suwon: "타임빌라스 수원점",
  goyang: "스타필드 고양점",
};

const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
const revisitBar = (n) =>
  ["🔴", "🟠", "🟡", "🟢", "💚"][n - 1] + " " + n + "/5";
const labelArr = (arr, map) => arr.map((v) => map[v] || v).join(", ") || "-";

async function sendSlackNotification(data) {
  if (!SLACK_WEBHOOK_URL) return;

  const store = STORE_LABEL[data.store_id] || data.store_id;
  const gender = GENDER_LABEL[data.gender] || data.gender;
  const age = AGE_LABEL[data.age] || data.age;
  const purposes = labelArr(data.purpose, PURPOSE_LABEL);
  const cats = labelArr(data.categories, CAT_LABEL);
  const products = labelArr(data.products, PRODUCT_LABEL);
  const buyPurpose = labelArr(data.buy_purpose, BUYPURPOSE_LABEL);
  const routes = labelArr(data.route, ROUTE_LABEL);
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  const hasImprove = data.comment_improve?.trim();
  const hasPraise = data.comment_praise?.trim();

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📋 새 설문 응답 — ${store}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*성별*\n${gender}` },
          { type: "mrkdwn", text: `*연령대*\n${age}` },
          {
            type: "mrkdwn",
            text: `*재방문 의향*\n${revisitBar(data.revisit)}`,
          },
          { type: "mrkdwn", text: `*방문 목적*\n${purposes}` },
          { type: "mrkdwn", text: `*방문 경로*\n${routes}` },
          { type: "mrkdwn", text: `*구매 목적*\n${buyPurpose}` },
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*🛋 체험 제품*`,
            `• 카테고리: ${cats}`,
            `• 제품: ${products}`,
          ].join("\n"),
        },
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*⭐ 제품 만족도*`,
            `• 디자인    ${stars(data.design)}`,
            `• 기능·사용성 ${stars(data.usability)}`,
            ``,
            `*🏪 매장 만족도*`,
            `• 직원 친절도 ${stars(data.staff)}`,
            `• 인테리어·청결 ${stars(data.store)}`,
            `• 체험 안내 ${stars(data.guide)}`,
          ].join("\n"),
        },
      },
    ],
  };

  if (hasImprove || hasPraise) {
    payload.blocks.push({ type: "divider" });
    if (hasImprove)
      payload.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🛠 아쉬운 점*\n>${data.comment_improve}`,
        },
      });
    if (hasPraise)
      payload.blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*💛 칭찬*\n>${data.comment_praise}` },
      });
  }

  payload.blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `🕐 ${now}` }],
  });

  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ─── 입력 검증 ────────────────────────────────────────
const VALID_GENDER = ["male", "female"];
const VALID_AGE = ["10s", "20s", "30s", "40s", "50s", "60plus"];
const VALID_PURPOSE = ["purchase", "experience", "gift", "inquiry"];
const VALID_CATEGORIES = [
  "lower_body",
  "back",
  "neck_shoulder",
  "massage_gun",
  "other",
];
const VALID_PRODUCTS = [
  "pulizee",
  "calf_v3",
  "pulition",
  "mat",
  "backpuller_v1",
  "back_cushion",
  "neck_tapping_v3",
  "neckpuller",
  "thepillow",
  "neck_travel",
  "minimax",
  "gun_belt",
  "turbofit",
  "wellwork",
  "hand_v1",
  "pediplaner",
  "airgua",
];
const VALID_BUY_PURPOSE = [
  "massage_strength",
  "design",
  "price",
  "gift_give",
  "other",
];
const VALID_ROUTE = ["sns", "search", "friend", "pass_by", "existing"];

const isRating = (v) => Number.isInteger(+v) && +v >= 1 && +v <= 5;
const filterArr = (arr, valid) =>
  Array.isArray(arr) ? arr.filter((v) => valid.includes(v)) : [];
const clean = (str, max = 300) =>
  typeof str === "string"
    ? str
        .replace(/<[^>]*>/g, "")
        .trim()
        .slice(0, max)
    : "";

// ══════════════════════════════════════════════════════
//  POST /api/survey
// ══════════════════════════════════════════════════════
app.post("/api/survey", async (req, res) => {
  try {
    const {
      store_id,
      gender,
      age,
      purpose,
      categories,
      products,
      design,
      usability,
      buy_purpose,
      staff,
      store,
      guide,
      route,
      revisit,
      comment_improve,
      comment_praise,
    } = req.body;

    if (!store_id || store_id.length > 50)
      return res.status(400).json({ error: "store_id 오류" });
    if (!VALID_GENDER.includes(gender))
      return res.status(400).json({ error: "성별 오류" });
    if (!VALID_AGE.includes(age))
      return res.status(400).json({ error: "연령대 오류" });
    if (!filterArr(purpose, VALID_PURPOSE).length)
      return res.status(400).json({ error: "방문목적 미선택" });
    if (!filterArr(categories, VALID_CATEGORIES).length)
      return res.status(400).json({ error: "카테고리 미선택" });
    if (!filterArr(products, VALID_PRODUCTS).length)
      return res.status(400).json({ error: "제품 미선택" });
    if (!isRating(design))
      return res.status(400).json({ error: "디자인 별점 오류" });
    if (!isRating(usability))
      return res.status(400).json({ error: "사용성 별점 오류" });
    if (!filterArr(buy_purpose, VALID_BUY_PURPOSE).length)
      return res.status(400).json({ error: "구매목적 미선택" });
    if (!isRating(staff))
      return res.status(400).json({ error: "직원친절도 별점 오류" });
    if (!isRating(store))
      return res.status(400).json({ error: "매장 별점 오류" });
    if (!isRating(guide))
      return res.status(400).json({ error: "체험안내 별점 오류" });
    if (!filterArr(route, VALID_ROUTE).length)
      return res.status(400).json({ error: "방문경로 미선택" });
    if (!isRating(revisit))
      return res.status(400).json({ error: "재방문의향 오류" });

    const safeImprove = clean(comment_improve);
    const safePraise = clean(comment_praise);

    const [result] = await db.execute(
      `INSERT INTO survey_responses
        (store_id, gender, age_group,
         purpose, categories, products,
         rating_design, rating_usability, buy_purpose,
         rating_staff, rating_store, rating_guide, visit_route,
         revisit_score, comment_improve, comment_praise, ip_address)
       VALUES (?,?,?, ?,?,?, ?,?,?, ?,?,?,?, ?,?,?,?)`,
      [
        store_id,
        gender,
        age,
        JSON.stringify(filterArr(purpose, VALID_PURPOSE)),
        JSON.stringify(filterArr(categories, VALID_CATEGORIES)),
        JSON.stringify(filterArr(products, VALID_PRODUCTS)),
        +design,
        +usability,
        JSON.stringify(filterArr(buy_purpose, VALID_BUY_PURPOSE)),
        +staff,
        +store,
        +guide,
        JSON.stringify(filterArr(route, VALID_ROUTE)),
        +revisit,
        safeImprove,
        safePraise,
        req.ip,
      ],
    );

    res.json({ success: true, id: result.insertId });

    sendSlackNotification({
      store_id,
      gender,
      age,
      purpose: filterArr(purpose, VALID_PURPOSE),
      categories: filterArr(categories, VALID_CATEGORIES),
      products: filterArr(products, VALID_PRODUCTS),
      design: +design,
      usability: +usability,
      buy_purpose: filterArr(buy_purpose, VALID_BUY_PURPOSE),
      staff: +staff,
      store: +store,
      guide: +guide,
      route: filterArr(route, VALID_ROUTE),
      revisit: +revisit,
      comment_improve: safeImprove,
      comment_praise: safePraise,
    }).catch((e) => console.error("[Slack] 전송 실패:", e));
  } catch (e) {
    console.error("[POST /api/survey]", e);
    res.status(500).json({ error: "서버 오류" });
  }
});

// ══════════════════════════════════════════════════════
//  GET /api/survey/results  — 매장별 통계
// ══════════════════════════════════════════════════════
app.get("/api/survey/results", async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        store_id,
        COUNT(*)                           AS total,
        ROUND(AVG(rating_design),    2)    AS avg_design,
        ROUND(AVG(rating_usability), 2)    AS avg_usability,
        ROUND(AVG(rating_staff),     2)    AS avg_staff,
        ROUND(AVG(rating_store),     2)    AS avg_store,
        ROUND(AVG(rating_guide),     2)    AS avg_guide,
        ROUND(AVG(revisit_score),    2)    AS avg_revisit,
        ROUND((AVG(rating_design)+AVG(rating_usability)+
               AVG(rating_staff)+AVG(rating_store)+AVG(rating_guide))/5, 2) AS avg_overall
      FROM survey_responses
      GROUP BY store_id
      ORDER BY total DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "서버 오류" });
  }
});

// ══════════════════════════════════════════════════════
//  GET /api/survey/list  — 전체 목록 (페이징)
// ══════════════════════════════════════════════════════
app.get("/api/survey/list", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const storeFilter = req.query.store || null;

    const where = storeFilter ? "WHERE store_id = ?" : "";
    const params = storeFilter ? [storeFilter, limit, offset] : [limit, offset];

    const [rows] = await db.execute(
      `SELECT id, store_id, gender, age_group,
              purpose, categories, products,
              rating_design, rating_usability, buy_purpose,
              rating_staff, rating_store, rating_guide, visit_route,
              revisit_score, comment_improve, comment_praise, submitted_at
       FROM survey_responses ${where}
       ORDER BY submitted_at DESC
       LIMIT ? OFFSET ?`,
      params,
    );

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total FROM survey_responses ${where}`,
      storeFilter ? [storeFilter] : [],
    );

    res.json({ rows, total, page, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "서버 오류" });
  }
});

// ══════════════════════════════════════════════════════
//  GET /api/dashboard  — 대시보드 전용 통계 API
// ══════════════════════════════════════════════════════
app.get("/api/dashboard", async (req, res) => {
  try {
    const storeFilter = req.query.store || null;
    const where = storeFilter ? "WHERE store_id = ?" : "";
    const params = storeFilter ? [storeFilter] : [];

    // 1) KPI + 별점 평균
    const [[kpi]] = await db.execute(
      `
      SELECT
        COUNT(*)                           AS total,
        ROUND(AVG(rating_design),    2)    AS avg_design,
        ROUND(AVG(rating_usability), 2)    AS avg_usability,
        ROUND(AVG(rating_staff),     2)    AS avg_staff,
        ROUND(AVG(rating_store),     2)    AS avg_store,
        ROUND(AVG(rating_guide),     2)    AS avg_guide,
        ROUND(AVG(revisit_score),    2)    AS avg_revisit
      FROM survey_responses ${where}
    `,
      params,
    );

    // 2) 매장별 응답 수 + 재방문 평균
    const [byStore] = await db.execute(`
      SELECT store_id, COUNT(*) AS total,
             ROUND(AVG(revisit_score), 2) AS avg_revisit
      FROM survey_responses
      GROUP BY store_id ORDER BY total DESC
    `);

    // 3) 성별
    const [genderRows] = await db.execute(
      `
      SELECT gender, COUNT(*) AS cnt
      FROM survey_responses ${where}
      GROUP BY gender
    `,
      params,
    );

    // 4) 연령대
    const [ageRows] = await db.execute(
      `
      SELECT age_group, COUNT(*) AS cnt
      FROM survey_responses ${where}
      GROUP BY age_group ORDER BY age_group
    `,
      params,
    );

    // 5) 전체 row (JSON 집계용)
    const [allRows] = await db.execute(
      `SELECT purpose, categories, products, buy_purpose, visit_route,
              comment_improve, comment_praise, gender, submitted_at
       FROM survey_responses ${where} ORDER BY submitted_at DESC`,
      params,
    );

    const total = kpi.total || 1;

    // JSON 배열 집계
    const countArr = (rows, field) => {
      const map = {};
      rows.forEach((r) => {
        let arr = [];
        try {
          arr = JSON.parse(r[field] || "[]");
        } catch {}
        arr.forEach((v) => {
          map[v] = (map[v] || 0) + 1;
        });
      });
      return map;
    };

    const purposeCount = countArr(allRows, "purpose");
    const catCount = countArr(allRows, "categories");
    const productCount = countArr(allRows, "products");
    const buyCount = countArr(allRows, "buy_purpose");
    const routeCount = countArr(allRows, "visit_route");

    // 성별 × 카테고리 크로스탭
    const genderCat = { male: {}, female: {} };
    allRows.forEach((r) => {
      const g = r.gender;
      if (!genderCat[g]) return;
      let cats = [];
      try {
        cats = JSON.parse(r.categories || "[]");
      } catch {}
      cats.forEach((c) => {
        genderCat[g][c] = (genderCat[g][c] || 0) + 1;
      });
    });

    // VOC 최신 20건
    const voc = allRows
      .slice(0, 20)
      .filter((r) => r.comment_improve || r.comment_praise)
      .map((r) => ({
        improve: r.comment_improve || "",
        praise: r.comment_praise || "",
        date: r.submitted_at,
      }));

    // 일별 응답 추이 (최근 14일)
    const [trendRows] = await db.execute(
      `SELECT DATE(submitted_at) AS day, COUNT(*) AS cnt
       FROM survey_responses
       WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       ${storeFilter ? "AND store_id = ?" : ""}
       GROUP BY day ORDER BY day`,
      storeFilter ? [storeFilter] : [],
    );

    res.json({
      kpi,
      byStore,
      gender: genderRows,
      age: ageRows,
      purpose: purposeCount,
      categories: catCount,
      products: productCount,
      buy_purpose: buyCount,
      route: routeCount,
      gender_cat: genderCat,
      voc,
      trend: trendRows,
      total_respondents: total,
    });
  } catch (e) {
    console.error("[GET /api/dashboard]", e);
    res.status(500).json({ error: "서버 오류" });
  }
});

// Health check
app.get("/health", (_, res) =>
  res.json({ status: "ok", time: new Date().toISOString() }),
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Survey API running on :${PORT}`));
