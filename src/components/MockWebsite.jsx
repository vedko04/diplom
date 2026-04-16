// Простой макет интернет-магазина — тестовый веб-интерфейс для исследования

export default function MockWebsite() {
  return (
      <div style={styles.root}>
        {/* ── Шапка ── */}
        <header style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.logo}>
              <span style={styles.logoIcon}>◈</span>
              <span style={styles.logoName}>LUMINA STORE</span>
            </div>
            <nav style={styles.nav}>
              {['Каталог', 'Новинки', 'Акции', 'О бренде', 'Контакты'].map(l => (
                  <a key={l} href="#" style={styles.navLink} onClick={e => e.preventDefault()}>{l}</a>
              ))}
            </nav>
            <div style={styles.headerActions}>
              <button style={styles.iconBtn}>🔍</button>
              <button style={styles.iconBtn}>♡</button>
              <button style={styles.cartBtn}>Корзина (2)</button>
            </div>
          </div>
        </header>

        {/* ── Хлебные крошки ── */}
        <div style={styles.breadcrumb}>
          <span style={styles.bcItem}>Главная</span>
          <span style={styles.bcSep}>›</span>
          <span style={styles.bcItem}>Аудиотехника</span>
          <span style={styles.bcSep}>›</span>
          <span style={{ ...styles.bcItem, color: '#111' }}>Lumina ANC-700</span>
        </div>

        {/* ── Основной контент ── */}
        <main style={styles.main}>
          {/* Галерея */}
          <div style={styles.gallery}>
            <div style={styles.mainImg}>
              <HeadphonesSVG />
            </div>
            <div style={styles.thumbRow}>
              {['#e8f4fd', '#fdf0e8', '#f0fde8'].map((bg, i) => (
                  <div key={i} style={{ ...styles.thumb, background: bg }}>
                    <span style={{ fontSize: 22 }}>🎧</span>
                  </div>
              ))}
            </div>
            <div style={styles.badge360}>360° VIEW</div>
          </div>

          {/* Информация о продукте */}
          <div style={styles.productInfo}>
            <div style={styles.brand}>LUMINA AUDIO</div>

            <h1 style={styles.productName}>
              Беспроводные наушники<br />
              <span style={styles.productModel}>ANC-700 Pro</span>
            </h1>

            <div style={styles.ratingRow}>
              <Stars rating={4.7} />
              <span style={styles.ratingNum}>4.7</span>
              <span style={styles.reviewCount}>1 240 отзывов</span>
              <span style={styles.inStock}>● В наличии</span>
            </div>

            <div style={styles.priceBlock}>
              <span style={styles.price}>12 990 ₽</span>
              <span style={styles.oldPrice}>18 500 ₽</span>
              <span style={styles.discount}>−30%</span>
            </div>

            {/* Варианты цвета */}
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Цвет: <strong>Midnight Black</strong></div>
              <div style={styles.colorRow}>
                {[
                  { bg: '#1a1a1a', name: 'Midnight Black', active: true },
                  { bg: '#f0ece4', name: 'Pearl White' },
                  { bg: '#2d4a7a', name: 'Navy Blue' },
                  { bg: '#7a3a3a', name: 'Burgundy' },
                ].map(c => (
                    <div
                        key={c.name}
                        title={c.name}
                        style={{
                          ...styles.colorSwatch,
                          background: c.bg,
                          boxShadow: c.active ? `0 0 0 2px white, 0 0 0 4px ${c.bg}` : 'none',
                        }}
                    />
                ))}
              </div>
            </div>

            {/* Ключевые характеристики */}
            <div style={styles.specs}>
              {[
                ['🔇', 'Активное шумоподавление', 'ANC до −35 дБ'],
                ['🔋', 'Время работы',             '40 часов'],
                ['🎵', 'Кодеки',                   'AAC / aptX HD / LDAC'],
                ['📡', 'Bluetooth',                '5.3 Multipoint'],
              ].map(([icon, label, val]) => (
                  <div key={label} style={styles.specRow}>
                    <span style={styles.specIcon}>{icon}</span>
                    <span style={styles.specLabel}>{label}</span>
                    <span style={styles.specVal}>{val}</span>
                  </div>
              ))}
            </div>

            {/* Кнопки */}
            <div style={styles.actions}>
              <button style={styles.btnCart}>Добавить в корзину</button>
              <button style={styles.btnBuy}>Купить сейчас</button>
            </div>

            <div style={styles.delivery}>
              🚚 Бесплатная доставка от 3 000 ₽ · Доставка: 1–2 дня
            </div>

            {/* Превью отзывов */}
            <div style={styles.reviewsBlock}>
              <div style={styles.reviewsTitle}>Последние отзывы</div>
              {[
                { author: 'Алексей К.', stars: 5, text: 'Потрясающее шумоподавление, ношу каждый день. Звук богатый и детальный.' },
                { author: 'Марина В.',  stars: 4, text: 'Отличные наушники, очень удобные. Чуть жмут после 4 часов, но звук шикарный.' },
              ].map(r => (
                  <div key={r.author} style={styles.review}>
                    <div style={styles.reviewHeader}>
                      <span style={styles.reviewAuthor}>{r.author}</span>
                      <Stars rating={r.stars} small />
                    </div>
                    <p style={styles.reviewText}>{r.text}</p>
                  </div>
              ))}
            </div>
          </div>
        </main>
      </div>
  )
}

function Stars({ rating, small }) {
  const size = small ? 12 : 14
  return (
      <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
          <svg key={i} width={size} height={size} viewBox="0 0 14 14">
            <polygon
                points="7,1 8.8,5.4 13.5,5.7 10,8.8 11.1,13.5 7,10.8 2.9,13.5 4,8.8 0.5,5.7 5.2,5.4"
                fill={i <= Math.round(rating) ? '#f5a623' : '#e0e0e0'}
            />
          </svg>
      ))}
    </span>
  )
}

function HeadphonesSVG() {
  return (
      <svg width="260" height="260" viewBox="0 0 260 260" fill="none">
        {/* Дуга обруча */}
        <path d="M 60 140 C 60 75 90 40 130 40 C 170 40 200 75 200 140"
              stroke="#222" strokeWidth="12" strokeLinecap="round" fill="none"/>
        {/* Левая чашка */}
        <rect x="38" y="128" width="44" height="68" rx="16" fill="#1a1a1a"/>
        <rect x="46" y="136" width="28" height="52" rx="10" fill="#2a2a2a"/>
        <circle cx="60" cy="162" r="10" fill="#333"/>
        {/* Правая чашка */}
        <rect x="178" y="128" width="44" height="68" rx="16" fill="#1a1a1a"/>
        <rect x="186" y="136" width="28" height="52" rx="10" fill="#2a2a2a"/>
        <circle cx="200" cy="162" r="10" fill="#333"/>
        {/* Блик */}
        <ellipse cx="190" cy="140" rx="8" ry="4" fill="white" opacity="0.12" transform="rotate(-20 190 140)"/>
      </svg>
  )
}

const styles = {
  root: {
    background: '#fff',
    minHeight: '100%',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    color: '#111',
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // Шапка
  header: {
    background: '#fff',
    borderBottom: '1px solid #eee',
    position: 'sticky', top: 0, zIndex: 10,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  headerInner: {
    maxWidth: 1100, margin: '0 auto',
    padding: '0 24px',
    height: 60,
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 24,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: { fontSize: 20, color: '#1a5cff' },
  logoName: { fontWeight: 700, fontSize: 15, letterSpacing: '0.08em', color: '#111' },
  nav: { display: 'flex', gap: 28 },
  navLink: { textDecoration: 'none', color: '#444', fontSize: 14 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  iconBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 6 },
  cartBtn: {
    background: '#1a5cff', color: '#fff',
    border: 'none', borderRadius: 8,
    padding: '8px 16px', fontSize: 13,
    cursor: 'pointer', fontWeight: 600,
  },

  // Хлебные крошки
  breadcrumb: {
    maxWidth: 1100, margin: '0 auto',
    padding: '12px 24px',
    display: 'flex', gap: 6, alignItems: 'center',
  },
  bcItem: { fontSize: 13, color: '#888', cursor: 'pointer' },
  bcSep: { color: '#ccc', fontSize: 12 },

  // Основной layout
  main: {
    maxWidth: 1100, margin: '0 auto',
    padding: '24px 24px 64px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 48,
  },

  // Галерея
  gallery: { position: 'relative' },
  mainImg: {
    background: '#f5f5f7',
    borderRadius: 16,
    height: 340,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  thumbRow: { display: 'flex', gap: 10 },
  thumb: {
    width: 72, height: 72,
    borderRadius: 10, border: '1px solid #e0e0e0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  badge360: {
    position: 'absolute', bottom: 82, right: 12,
    background: '#1a5cff', color: '#fff',
    fontSize: 10, fontWeight: 700,
    padding: '4px 8px', borderRadius: 4, letterSpacing: '0.06em',
  },

  // Инфо о продукте
  productInfo: { paddingTop: 8 },
  brand: { fontSize: 11, letterSpacing: '0.16em', color: '#888', marginBottom: 8 },
  productName: { fontSize: 22, fontWeight: 700, lineHeight: 1.3, marginBottom: 12 },
  productModel: { color: '#1a5cff' },
  ratingRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
  ratingNum: { fontWeight: 700, fontSize: 14 },
  reviewCount: { color: '#888', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' },
  inStock: { marginLeft: 'auto', color: '#22c55e', fontSize: 12, fontWeight: 600 },
  priceBlock: { display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 24 },
  price: { fontSize: 28, fontWeight: 800, color: '#111' },
  oldPrice: { fontSize: 16, color: '#aaa', textDecoration: 'line-through' },
  discount: {
    background: '#fee2e2', color: '#dc2626',
    fontSize: 12, fontWeight: 700,
    padding: '3px 8px', borderRadius: 4,
  },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, marginBottom: 10, color: '#555' },
  colorRow: { display: 'flex', gap: 10 },
  colorSwatch: { width: 28, height: 28, borderRadius: '50%', cursor: 'pointer' },
  specs: {
    background: '#f8f9fa', borderRadius: 10,
    padding: '16px 20px', marginBottom: 24,
  },
  specRow: {
    display: 'flex', alignItems: 'center',
    gap: 10, paddingBottom: 10, marginBottom: 10,
    borderBottom: '1px solid #eee', fontSize: 13,
  },
  specIcon: { fontSize: 16, width: 24, flexShrink: 0 },
  specLabel: { flex: 1, color: '#555' },
  specVal: { fontWeight: 600, color: '#111' },
  actions: { display: 'flex', gap: 12, marginBottom: 14 },
  btnCart: {
    flex: 1, padding: '14px',
    background: '#fff', border: '2px solid #1a5cff',
    borderRadius: 10, color: '#1a5cff',
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  btnBuy: {
    flex: 1, padding: '14px',
    background: '#1a5cff', border: 'none',
    borderRadius: 10, color: '#fff',
    fontWeight: 700, fontSize: 14, cursor: 'pointer',
  },
  delivery: { fontSize: 12, color: '#666', marginBottom: 24 },
  reviewsBlock: { borderTop: '1px solid #eee', paddingTop: 20 },
  reviewsTitle: { fontWeight: 700, fontSize: 14, marginBottom: 14 },
  review: {
    background: '#f8f9fa', borderRadius: 10,
    padding: '12px 16px', marginBottom: 10,
  },
  reviewHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  reviewAuthor: { fontWeight: 600, fontSize: 13 },
  reviewText: { fontSize: 13, color: '#555', lineHeight: 1.5 },
}