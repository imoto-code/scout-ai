import { useState, useEffect } from 'react';

const SHEET_API = 'https://script.google.com/macros/s/AKfycbwrACEaTgYEEXkfHWj-qp4HudKgnfAGiRnprunXK1M61xDuR1n8JWzWBHzlO9Afk6tZmw/exec';

export default function Home() {
  const [profile, setProfile] = useState('');
  const [jobs, setJobs] = useState([]);
  const [filteredIdxs, setFilteredIdxs] = useState([]);
  const [selectedIdxs, setSelectedIdxs] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sheetStatus, setSheetStatus] = useState('loading');
  const [statusText, setStatusText] = useState('スプレッドシートを読み込み中...');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { loadJobs(); }, []);

  async function loadJobs() {
    setSheetStatus('loading');
    setStatusText('スプレッドシートを読み込み中...');
    try {
      const res = await fetch(SHEET_API);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('データが空です');
      const parsed = data.map(r => ({
        cat: String(r.cat || ''),
        company: String(r.company || ''),
        position: String(r.position || ''),
        content: String(r.content || ''),
        salary: String(r.salary || ''),
      })).filter(j => j.company);
      setJobs(parsed);
      setFilteredIdxs(parsed.map((_, i) => i));
      setSheetStatus('ok');
      setStatusText(parsed.length + '件を読み込みました');
    } catch (err) {
      setSheetStatus('err');
      setStatusText('読み込み失敗: ' + err.message);
    }
  }

  const cats = ['all', ...new Set(jobs.map(j => j.cat).filter(Boolean))];

  function applyFilter(cat, search, allJobs) {
    const j = allJobs || jobs;
    let idxs = j.map((_, i) => i);
    if (cat !== 'all') idxs = idxs.filter(i => j[i].cat === cat || j[i].cat.includes(cat));
    if (search) idxs = idxs.filter(i => j[i].company.includes(search) || j[i].position.includes(search));
    return idxs;
  }

  function filterJobs(cat) {
    setActiveFilter(cat);
    setSelectedIdxs([]);
    setFilteredIdxs(applyFilter(cat, searchText));
  }

  function handleSearch(text) {
    setSearchText(text);
    setFilteredIdxs(applyFilter(activeFilter, text));
  }

  function toggleSelect(idx) {
    setSelectedIdxs(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }

  function toggleAll(checked) {
    setSelectedIdxs(checked ? [...filteredIdxs] : []);
  }

  async function generate() {
    if (!profile) { alert('候補者プロフィールを入力してください'); return; }
    if (jobs.length === 0) { alert('求人データが読み込まれていません'); return; }

    const pool = selectedIdxs.length > 0 ? selectedIdxs.map(i => jobs[i]) : jobs;
    setLoading(true);
    setResult(null);
    setError('');

    const jobsText = pool.map((j, i) => '[' + (i+1) + '] ' + j.company + ' / ' + j.position + ' / ' + j.content + ' / 年収' + j.salary).join('\n');

    const prompt = `あなたは中途採用の優秀なリクルーティングエージェント（PARQUE）です。候補者プロフィールと求人リストをもとに、候補者の心を動かす高品質なスカウトメッセージを生成してください。

【候補者プロフィール】
${profile}

【求人リスト（${pool.length}件）】
${jobsText}

【STEP1：求人選定ルール（最優先）】
- 候補者に最もマッチする3件を選ぶ（2件でも可）
- 年収マッチング：候補者の現年収以上かつ希望年収の範囲内を優先。現年収を大幅に下回る求人は選ばない
- 現年収が不明な場合は役職・業界・経験年数から推定する

【STEP2：件名3案のルール（必ず守ること）】
件名は必ず以下の3つの異なる軸で1案ずつ作成する。軸が重複してはいけない。
・案1【職種/実績推し】：候補者の具体的な数字や職種実績を前面に出し、その強みが活きるポジションを示す
・案2【キャリアチェンジ/成長推し】：候補者の希望職種や業界転換にフォーカスし、次のキャリアステップを提示する
・案3【市場価値/年収推し】：年収アップや市場価値向上の観点から、候補者が得られる成長機会を訴求する
各件名：冒頭と末尾に🔶をつける／候補者の具体的な数字・実績・スキルを必ず入れる／30〜50文字程度

【STEP3：本文構成（必ず守ること）】
①冒頭（2〜3文）：候補者の具体的な実績・数字・スキルを引用しながら、なぜ連絡したのかの理由を述べる。
②▼ご提案したいキャリアの可能性（箇条書き2〜3点）：各項目は「・【具体的な職種名】：現職の○○スキルを活かして、〜〜できるキャリア」の形式。具体的な職種名・活かし方・得られる成果まで踏み込む。候補者の希望職種・希望業種・興味のある働き方を必ず考慮する。
③▼具体的な求人提案：選んだ求人を「―――――――――――――――――――――\n【会社名】：\n【ポジション】：\n【業務内容】：\n【年収】：\n―――――――――――――――――――――」のフォーマットで全件記載
④▼今回のご転職活動のポイント（■ポイント①②）：ポイント①は候補者が直面しうる転職の障壁を先出しした上で弊社PARQUEの介在価値（独自コーチングメソッドによるスキル言語化支援・組織コンサル事業で得た企業内部情報と人事視点での面接対策・年収交渉代行）を示す。ポイント②は中長期キャリア戦略の観点から別の懸念を提示し5年後の市場価値から逆算したロードマップ提供という介在価値を盛り込む。

【文体】丁寧・フォーマル。具体的な数字・実績を積極的に引用。ポイントは「問題提起→弊社の解決策」の流れで書く。

必ずJSONのみで返答（前後のテキスト・バッククォート一切不要）:
{"subjects":["案1件名","案2件名","案3件名"],"matched_jobs":["会社名1","会社名2","会社名3"],"body":"本文全文"}`;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'APIエラー');
      const text = data.content.map(b => b.text || '').join('');
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      setResult(parsed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyText(text, btnId) {
    navigator.clipboard.writeText(text);
    const btn = document.getElementById(btnId);
    if (btn) { const o = btn.textContent; btn.textContent = '✓ コピー完了'; setTimeout(() => { btn.textContent = o; }, 2000); }
  }

  const statusColor = { loading: '#f0c040', ok: '#3ecf8e', err: '#ff6b6b' }[sheetStatus];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0f14; color: #e8eaf2; font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #2a2f42; border-radius: 3px; }
        @keyframes shimmer { to { background-position: -200% 0; } }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderBottom: '1px solid #2a2f42', background: '#161920' }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#4f7eff,#7c5cfc)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>S</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Scout<span style={{ color: '#4f7eff' }}>AI</span></div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#7b82a0' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
              {statusText}
            </div>
            <button onClick={loadJobs} style={{ fontSize: 11, color: '#4f7eff', background: 'rgba(79,126,255,0.1)', border: '1px solid rgba(79,126,255,0.3)', padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}>🔄 再読み込み</button>
            <div style={{ fontSize: 11, color: '#7b82a0', background: '#1e2230', border: '1px solid #2a2f42', padding: '4px 10px', borderRadius: 20 }}>PABLO Group · β版</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* Left Panel */}
          <div style={{ padding: 24, borderRight: '1px solid #2a2f42', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto' }}>

            <div>
              <div style={{ fontSize: 10, color: '#7b82a0', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>候補者プロフィール</div>
              <textarea value={profile} onChange={e => setProfile(e.target.value)}
                placeholder={'求人媒体のプロフィールテキストをここに貼り付けてください。\n\n例）27歳 / 男性 / 大阪府\n株式会社ネクステージ / 販売営業・副店長\n希望職種：人材・採用 / 法人営業...'}
                style={{ width: '100%', minHeight: 200, background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, color: '#e8eaf2', fontSize: 13, lineHeight: 1.7, padding: 14, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#7b82a0', letterSpacing: '1.5px', textTransform: 'uppercase' }}>求人マスタ（スプレッドシート連携）</div>
                <div style={{ fontSize: 11, background: 'rgba(79,126,255,0.15)', color: '#4f7eff', borderRadius: 20, padding: '2px 10px' }}>{filteredIdxs.length}件</div>
              </div>

              {/* 企業名検索 */}
              <input
                type="text"
                placeholder="🔍 企業名・ポジションで検索..."
                value={searchText}
                onChange={e => handleSearch(e.target.value)}
                style={{ width: '100%', background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 8, color: '#e8eaf2', fontSize: 12, padding: '8px 12px', outline: 'none', marginBottom: 8, fontFamily: 'inherit' }}
              />

              {/* カテゴリフィルター */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {cats.map(cat => (
                  <button key={cat} onClick={() => filterJobs(cat)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (activeFilter === cat ? '#4f7eff' : '#2a2f42'), background: activeFilter === cat ? 'rgba(79,126,255,0.1)' : 'none', color: activeFilter === cat ? '#4f7eff' : '#7b82a0', fontFamily: 'inherit' }}>
                    {cat === 'all' ? 'すべて' : cat}
                  </button>
                ))}
              </div>

              {/* 求人テーブル */}
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #2a2f42', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#1e2230', color: '#7b82a0', padding: '8px 10px', textAlign: 'left', fontSize: 10, position: 'sticky', top: 0, borderBottom: '1px solid #2a2f42', width: 28 }}>
                        <input type="checkbox" onChange={e => toggleAll(e.target.checked)} style={{ accentColor: '#4f7eff' }} />
                      </th>
                      {['カテゴリ', '企業名', 'ポジション', '年収'].map(h => (
                        <th key={h} style={{ background: '#1e2230', color: '#7b82a0', padding: '8px 10px', textAlign: 'left', fontSize: 10, position: 'sticky', top: 0, borderBottom: '1px solid #2a2f42' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIdxs.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#7b82a0', fontSize: 12 }}>該当する求人がありません</td></tr>
                    ) : filteredIdxs.map(idx => {
                      const j = jobs[idx];
                      const sel = selectedIdxs.includes(idx);
                      return (
                        <tr key={idx} onClick={() => toggleSelect(idx)} style={{ background: sel ? 'rgba(79,126,255,0.08)' : 'transparent', cursor: 'pointer' }}>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid #2a2f42', textAlign: 'center' }}>
                            <input type="checkbox" checked={sel} onChange={() => toggleSelect(idx)} onClick={e => e.stopPropagation()} style={{ accentColor: '#4f7eff' }} />
                          </td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid #2a2f42' }}>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(79,126,255,0.2)', color: '#8aabff', whiteSpace: 'nowrap' }}>{j.cat}</span>
                          </td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid #2a2f42', fontSize: 11 }}>{j.company}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid #2a2f42', fontSize: 11, color: '#7b82a0' }}>{j.position}</td>
                          <td style={{ padding: '7px 10px', borderBottom: '1px solid #2a2f42', fontSize: 10, color: '#7b82a0', whiteSpace: 'nowrap' }}>{j.salary}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 12, color: '#7b82a0', textAlign: 'center', padding: 6, border: '1px dashed #2a2f42', borderRadius: 8, marginTop: 8 }}>
                {selectedIdxs.length === 0
                  ? 'チェックなし → AIが全件から自動選択します'
                  : <span><span style={{ color: '#4f7eff', fontWeight: 700 }}>{selectedIdxs.length}件</span>を選択 → この中からAIが最適なものを提案</span>}
              </div>
            </div>

            <button onClick={generate} disabled={loading}
              style={{ width: '100%', padding: 15, background: 'linear-gradient(135deg,#4f7eff,#7c5cfc)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit' }}>
              {loading ? '⏳ 生成中...' : '✦ スカウト文面を生成する'}
            </button>
          </div>

          {/* Right Panel */}
          <div style={{ padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!result && !error && !loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: '#7b82a0', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, background: '#1e2230', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>✦</div>
                <p style={{ fontSize: 14, lineHeight: 1.7 }}>候補者情報を貼り付けて<br />「生成する」を押してください<br /><span style={{ fontSize: 12 }}>求人はスプレッドシートから自動で読み込まれます</span></p>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[52, 52, 52, 420].map((h, i) => (
                  <div key={i} style={{ height: h, borderRadius: 8, background: 'linear-gradient(90deg,#1e2230 25%,#2a2f42 50%,#1e2230 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                ))}
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 12, padding: 16, fontSize: 13, color: '#ff8080', lineHeight: 1.7 }}>
                ⚠️ エラー：{error}
              </div>
            )}

            {result && (
              <>
                <div>
                  <div style={{ fontSize: 11, color: '#7b82a0', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    件名 3案 <div style={{ flex: 1, height: 1, background: '#2a2f42' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.subjects.map((s, i) => (
                      <div key={i} style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ fontSize: 10, color: '#7b82a0', background: '#0d0f14', border: '1px solid #2a2f42', borderRadius: 4, padding: '2px 6px', minWidth: 28, textAlign: 'center', flexShrink: 0, marginTop: 2 }}>案{i+1}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}>{s}</div>
                        <button id={'sub-' + i} onClick={() => copyText(s, 'sub-' + i)}
                          style={{ background: 'none', border: '1px solid #2a2f42', borderRadius: 6, color: '#7b82a0', fontSize: 11, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>コピー</button>
                      </div>
                    ))}
                  </div>
                </div>

                {result.matched_jobs?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#7b82a0', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      AIが選んだ求人 <div style={{ flex: 1, height: 1, background: '#2a2f42' }} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.matched_jobs.map((j, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(79,126,255,0.08)', border: '1px solid rgba(79,126,255,0.25)', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
                          <div style={{ width: 6, height: 6, background: '#4f7eff', borderRadius: '50%' }} />{j}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 11, color: '#7b82a0', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    本文 <div style={{ flex: 1, height: 1, background: '#2a2f42' }} />
                  </div>
                  <div style={{ background: '#1e2230', border: '1px solid #2a2f42', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.95, whiteSpace: 'pre-wrap' }}>{result.body}</div>
                    <button id="bodyBtn" onClick={() => copyText(result.body, 'bodyBtn')}
                      style={{ marginTop: 14, width: '100%', padding: 10, background: 'none', border: '1px solid #2a2f42', borderRadius: 8, color: '#7b82a0', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      📋 本文をコピー
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
