/* =========================================================
   gen_starter.js — data/moves/library.json → STARTER_MOVES の唯一の変換点（MOVELIST-01）

   正は data/moves/library.json 1つ。ここはファイルI/Oを持たん
   （build.js と tools/verify_signature_moves.js の両方から使い回すため、
   呼び出し側が読み込んだ library オブジェクトを渡す形にする）。

   status（MOVELIST-02）:
     status を書いとらん技は 'made' 扱い（後方互換）。
     dist へ焼き込まれ・技棚に出るのは made（省略含む）だけ。idea/retired は焼かん。
   ========================================================= */
'use strict';

/* status が無い・空文字・null のときは made 扱いにする後方互換の唯一の実装点。
   他の場所にこの判定を重複させない。 */
function isMade(rec) {
  const status = (rec && rec.status) || 'made';
  return status === 'made';
}

/* library（{名前: レコード}）を STARTER_MOVES の要素形の配列にする。
   made（省略含む）だけを対象にする。 */
function genStarterEntries(library) {
  return Object.values(library || {})
    .filter(isMade)
    .map((rec) => ({ name: rec.name, battle: rec.battle, audio: rec.audio || [], fx: rec.fx }));
}

/* build.js の /*__STARTER__*​/ に差し込む文字列を作る。 */
function genStarterSource(library) {
  const entries = genStarterEntries(library);
  return '/* 生成物。手で編集せん。正は data/moves/library.json（tools/gen_starter.js 経由） */\n' +
    'const STARTER_MOVES = ' + JSON.stringify(entries) + ';\n';
}

module.exports = { isMade, genStarterEntries, genStarterSource };
